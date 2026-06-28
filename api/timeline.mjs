import {
  createPublicClient,
  http,
  parseAbiItem,
} from "viem";
import { celo } from "viem/chains";

const CONTRACT_ADDRESS =
  process.env.AIDTRACE_CONTRACT ||
  "0xaf5c40e82ac9255479a1f447e81992b71c4f4934";

const CELO_RPC_URL =
  process.env.CELO_RPC_URL ||
  "https://forno.celo.org";

const CELOSCAN_TX_BASE =
  process.env.CELOSCAN_TX_BASE ||
  "https://celoscan.io/tx";

// Use a recent block to avoid scanning the full Celo chain.
// Adjust later if needed.
const FROM_BLOCK = BigInt(process.env.AIDTRACE_FROM_BLOCK || "70700000");

const aidTraceEvent = parseAbiItem(
  "event AidTraceEvent(bytes32 indexed batchId, bytes32 indexed actionType, address indexed sender, bytes32 dataHash, string referenceURI, uint16 schemaVersion, uint16 flags)"
);

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC_URL),
});

function bytes32ToText(value) {
  const clean = String(value || "")
    .replace(/^0x/, "")
    .replace(/(00)+$/g, "");

  if (!clean) return "";

  const bytes = clean.match(/.{1,2}/g).map((byte) => parseInt(byte, 16));
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\0/g, "");
}

function parseReferenceURI(referenceURI) {
  const parts = String(referenceURI || "")
    .split("|")
    .map((part) => part.trim());

  return {
    source: parts[0] || "",
    summary: parts[1] || "",
    details: parts.slice(2).join(" | ") || "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);

    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: aidTraceEvent,
      fromBlock: FROM_BLOCK,
      toBlock: "latest",
    });

    const latestLogs = logs.slice(-limit).reverse();

    const events = await Promise.all(
      latestLogs.map(async (log) => {
        const block = await publicClient.getBlock({
          blockNumber: log.blockNumber,
        });

        const txHash = log.transactionHash;
        const txUrl = `${CELOSCAN_TX_BASE}/${txHash}`;
        const reference = parseReferenceURI(log.args.referenceURI);

        return {
          id: `${txHash}-${log.logIndex}`,
          batchId: bytes32ToText(log.args.batchId),
          actionType: bytes32ToText(log.args.actionType),
          sender: log.args.sender,
          dataHash: log.args.dataHash,
          referenceURI: log.args.referenceURI,
          source: reference.source,
          details: reference.details,
          status: "sent_to_relayer",
          txHash,
          txUrl,
          qrLink: txUrl,
          blockNumber: Number(log.blockNumber),
          blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
        };
      })
    );

    return res.status(200).json({
      ok: true,
      contractAddress: CONTRACT_ADDRESS,
      events,
    });
  } catch (error) {
    console.error("Timeline error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Timeline error",
    });
  }
}