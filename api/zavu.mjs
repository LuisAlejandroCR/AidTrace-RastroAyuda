import Zavudev from "@zavudev/sdk";
import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  pad,
  stringToBytes,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const CONTRACT_ADDRESS =
  process.env.AIDTRACE_CONTRACT || "0xaf5c40e82ac9255479a1f447e81992b71c4f4934";
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const abi = [
  {
    type: "function",
    name: "recordAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "actionType", type: "bytes32" },
      { name: "dataHash", type: "bytes32" },
      { name: "sender", type: "address" },
      { name: "referenceURI", type: "string" },
    ],
    outputs: [],
  },
];

const zavu = new Zavudev({
  apiKey: process.env.RASTROAYUDA_ZAVU_API_KEY,
});

function bytes32Text(value) {
  return pad(toBytes(String(value).toUpperCase().slice(0, 31)), { size: 32 });
}

function parseAidTraceText(text) {
  const clean = String(text || "").trim();
  const match = clean.match(
    /^AT\s+(PICKUP|DELIVER|REVIEW)\s+([A-Za-z0-9-_]+)\s*(.*)$/i,
  );

  if (!match) {
    throw new Error("Formato no reconocido. Usa: AT PICKUP BATCH-001 detalles");
  }

  return {
    actionType: match[1].toUpperCase(),
    batchId: match[2].toUpperCase(),
    details: match[3] || "sin detalles",
  };
}

function getReplyRecipient(data) {
  if (data.channel === "telegram") {
    return data.telegramChatId || data.chatId || data.from;
  }

  return String(data.from || "").replace(/^(sms|whatsapp|telegram):/, "");
}

function getMessageId(event, data) {
  return data.messageId || data.id || event.id || randomUUID();
}

async function recordOnCelo(event, data, parsed) {
  const privateKey = process.env.RASTROAYUDA_RELAYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing RASTROAYUDA_RELAYER_PRIVATE_KEY");
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error("Missing AIDTRACE_CONTRACT");
  }

  const messageId = getMessageId(event, data);
  const normalized = {
    source: "zavu",
    channel: data.channel,
    from: data.from,
    telegramChatId: data.telegramChatId,
    messageId,
    actionType: parsed.actionType,
    batchId: parsed.batchId,
    details: parsed.details,
    receivedAt: new Date().toISOString(),
  };

  const account = privateKeyToAccount(privateKey);
  const transport = http(CELO_RPC_URL);
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport,
  });
  const publicClient = createPublicClient({
    chain: celo,
    transport,
  });

  const txHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "recordAction",
    args: [
      bytes32Text(parsed.batchId),
      bytes32Text(parsed.actionType),
      keccak256(stringToBytes(JSON.stringify(normalized))),
      ZERO_ADDRESS,
      `zavu:${messageId}`,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error(`Celo transaction failed: ${txHash}`);
  }

  return { messageId, txHash };
}

function buildSuccessReply(parsed, txHash) {
  return [
    `Registrado en Celo: ${parsed.actionType} ${parsed.batchId}`,
    `Detalles: ${parsed.details}`,
    `Tx: ${txHash}`,
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const event = req.body || {};

    console.log("Zavu event:", JSON.stringify(event, null, 2));

    if (event.type !== "message.inbound") {
      return res.status(200).send("Ignored");
    }

    const data = event.data || {};
    const channel = data.channel;
    const to = getReplyRecipient(data);

    if (!to || !channel) {
      return res.status(400).send("Missing recipient/channel");
    }

    let parsed;
    let replyText;
    let idempotencyKey;

    try {
      parsed = parseAidTraceText(data.text);
      const { messageId, txHash } = await recordOnCelo(event, data, parsed);
      replyText = buildSuccessReply(parsed, txHash);
      idempotencyKey = `aidtrace-reply-${messageId}`;
    } catch (error) {
      replyText = error.message || "No se pudo registrar el evento.";
      idempotencyKey = `aidtrace-error-${getMessageId(event, data)}`;
    }

    await zavu.messages.send({
      to,
      channel,
      text: replyText,
      idempotencyKey,
    });

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).send("Webhook error");
  }
}
