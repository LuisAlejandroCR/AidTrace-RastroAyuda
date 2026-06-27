import { defineFunction } from "@zavu/functions";
import { createWalletClient, http, keccak256, pad, stringToBytes, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

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
] as const;

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;

function bytes32Text(value: string) {
  return pad(toBytes(value.toUpperCase().slice(0, 31)), { size: 32 });
}

function parseAidTraceText(text: string) {
  const parts = text.trim().split(/\s+/);
  if (parts[0]?.toUpperCase() !== "AT" || parts.length < 3) {
    throw new Error("Expected: AT <ACTION> <BATCH_ID> [details]");
  }

  return {
    actionType: parts[1].toUpperCase(),
    batchId: parts[2].toUpperCase(),
    details: parts.slice(3).join(" "),
  };
}

export default defineFunction(async (event, ctx) => {
  if (event.type !== "message.inbound") {
    return { ok: true, ignored: true };
  }

  const data = event.data as {
    from?: string;
    text?: string;
    channel?: string;
    messageId?: string;
  };

  const parsed = parseAidTraceText(data.text || "");
  const normalized = {
    source: "zavu",
    from: data.from,
    channel: data.channel,
    messageId: data.messageId,
    ...parsed,
    receivedAt: new Date().toISOString(),
  };

  const rpcUrl = process.env.CELO_RPC_URL!;
  const contract = process.env.AIDTRACE_CONTRACT as `0x${string}`;
  const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as `0x${string}`);

  const client = createWalletClient({
    account,
    chain: celo,
    transport: http(rpcUrl),
  });

  const txHash = await client.writeContract({
    address: contract,
    abi,
    functionName: "recordAction",
    args: [
      bytes32Text(parsed.batchId),
      bytes32Text(parsed.actionType),
      keccak256(stringToBytes(JSON.stringify(normalized))),
      zeroAddress,
      `zavu:${data.messageId || ctx.awsRequestId}`,
    ],
  });

  ctx.log("aidtrace recorded", {
    batchId: parsed.batchId,
    actionType: parsed.actionType,
    txHash,
  });

  return {
    ok: true,
    batchId: parsed.batchId,
    actionType: parsed.actionType,
    txHash,
  };
});
