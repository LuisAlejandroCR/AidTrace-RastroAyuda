import Zavudev from "@zavudev/sdk";
import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  stringToHex,
  stringToBytes,
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

const ACTION_ALIASES = {
  PICKUP: "PICKUP",
  PICKED_UP: "PICKUP",
  RECOGER: "PICKUP",
  RECOGIDO: "PICKUP",
  RETIRO: "PICKUP",
  RECIBIR: "PICKUP",
  DELIVER: "DELIVER",
  DELIVERED: "DELIVER",
  DELIVERY: "DELIVER",
  ENTREGAR: "DELIVER",
  ENTREGADO: "DELIVER",
  ENTREGA: "DELIVER",
  REVIEW: "REVIEW",
  REVISAR: "REVIEW",
  REVISION: "REVIEW",
  REVISADO: "REVIEW",
  REPORTE: "REVIEW",
};

const COMMAND_PREFIXES = new Set(["AT", "AIDTRACE", "RASTROAYUDA", "RASTRO"]);
const HELP_WORDS = new Set(["HELP", "AYUDA", "START", "INICIO"]);

function bytes32Text(value) {
  return stringToHex(String(value).toUpperCase().slice(0, 31), { size: 32 });
}

function normalizeCommandPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function usageMessage() {
  return [
    "Formato no reconocido.",
    "Usa: AT DELIVER AT-DEMO-001 detalles",
    "O: AT ENTREGAR AT-DEMO-001 detalles",
    "Acciones: PICKUP/RECOGER, DELIVER/ENTREGAR, REVIEW/REVISAR",
  ].join("\n");
}

function parseAidTraceText(text) {
  const clean = String(text || "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);

  if (!parts.length) {
    throw new Error(usageMessage());
  }

  if (HELP_WORDS.has(normalizeCommandPart(parts[0]))) {
    throw new Error(usageMessage());
  }

  if (COMMAND_PREFIXES.has(normalizeCommandPart(parts[0]))) {
    parts.shift();
  }

  const actionType = ACTION_ALIASES[normalizeCommandPart(parts[0])];
  const batchId = parts[1];

  if (!actionType || !batchId) {
    throw new Error(usageMessage());
  }

  return {
    actionType,
    batchId: batchId.toUpperCase(),
    details: parts.slice(2).join(" ") || "sin detalles",
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

function normalizeAddress(value) {
  return getAddress(String(value).toLowerCase());
}

async function recordOnCelo(event, data, parsed, options = {}) {
  const privateKey = process.env.RASTROAYUDA_RELAYER_PRIVATE_KEY;
  const messageId = options.messageId || getMessageId(event, data);
  const source = options.source || "zavu";

  if (!privateKey) {
    throw new Error("Missing RASTROAYUDA_RELAYER_PRIVATE_KEY");
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error("Missing AIDTRACE_CONTRACT");
  }

  const normalized = {
    source,
    channel: data.channel,
    from: data.from,
    telegramChatId: data.telegramChatId,
    messageId,
    actionType: parsed.actionType,
    batchId: parsed.batchId,
    details: parsed.details,
    receivedAt: new Date().toISOString(),
    ...(options.extraData || {}),
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
    address: normalizeAddress(CONTRACT_ADDRESS),
    abi,
    functionName: "recordAction",
    args: [
      bytes32Text(parsed.batchId),
      bytes32Text(parsed.actionType),
      keccak256(stringToBytes(JSON.stringify(normalized))),
      ZERO_ADDRESS,
      options.referenceURI || `${source}:${messageId}`,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error(`Celo transaction failed: ${txHash}`);
  }

  return { messageId, txHash };
}

function relayEventToParsed(event) {
  if (!event?.batchId || !event?.actionType) {
    throw new Error("Relay event missing batchId/actionType");
  }

  return {
    actionType: String(event.actionType).toUpperCase(),
    batchId: String(event.batchId).toUpperCase(),
    details: event.note || event.locationText || event.senderName || "sin detalles",
  };
}

async function handleBrowserRelay(packet, res) {
  const pending = Array.isArray(packet.pending) ? packet.pending : [];
  const recorded = [];

  for (const item of pending) {
    const parsed = relayEventToParsed(item);
    const result = await recordOnCelo(
      { id: item.id || randomUUID() },
      {
        channel: "browser",
        from: item.senderName || "AidTrace browser",
        messageId: item.id,
      },
      parsed,
      {
        source: "browser",
        messageId: item.id,
        referenceURI: item.ref || `aidtrace:${parsed.batchId}`,
        extraData: item,
      },
    );

    recorded.push({
      id: item.id,
      batchId: parsed.batchId,
      actionType: parsed.actionType,
      txHash: result.txHash,
    });
  }

  return res.status(200).json({ ok: true, recorded });
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

    if (event.schema === "aidtrace.relay.v1") {
      return handleBrowserRelay(event, res);
    }

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
