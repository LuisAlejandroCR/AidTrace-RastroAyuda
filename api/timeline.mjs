import {
  createPublicClient,
  http,
  parseAbiItem,
} from "viem";
import { celo } from "viem/chains";
import { bytes32ToText, parseReferenceURI } from "../lib/timeline-parser.mjs";

const CONTRACT_ADDRESS =
  process.env.AIDTRACE_CONTRACT ||
  "0xaf5c40e82ac9255479a1f447e81992b71c4f4934";

const CELO_RPC_URL =
  process.env.CELO_RPC_URL ||
  "https://forno.celo.org";

const CELOSCAN_TX_BASE =
  process.env.CELOSCAN_TX_BASE ||
  "https://celoscan.io/tx";

const DEPLOYMENT_TX_HASH =
  process.env.AIDTRACE_DEPLOYMENT_TX_HASH ||
  "0xffff51135fb18030c1cc3f9fbfddfdbb1b0540c77c6824b9a9c1f7d163e908c2";
const LOG_BLOCK_STEP = 4_900n;
const TIMELINE_INDEX_ENABLED = process.env.AIDTRACE_TIMELINE_INDEX_ENABLED !== "false";
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const NORMALIZED_CONTRACT_ADDRESS = CONTRACT_ADDRESS.toLowerCase();
const DEFAULT_ALLOWED_ORIGINS = [
  "https://aidtrace-rastroayuda.vercel.app",
  "http://127.0.0.1:8017",
  "http://localhost:8017",
];
const ALLOWED_ORIGINS = new Set(
  (process.env.AIDTRACE_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const aidTraceEvent = parseAbiItem(
  "event AidTraceEvent(bytes32 indexed batchId, bytes32 indexed actionType, address indexed sender, bytes32 dataHash, string referenceURI, uint16 schemaVersion, uint16 flags)"
);

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC_URL),
});

function requestOrigin(req) {
  return String(req.headers.origin || "");
}

function isAllowedOrigin(origin) {
  return Boolean(origin && ALLOWED_ORIGINS.has(origin));
}

function setCors(req, res) {
  const origin = requestOrigin(req);
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function timelineFromBlock() {
  if (process.env.AIDTRACE_FROM_BLOCK) {
    return BigInt(process.env.AIDTRACE_FROM_BLOCK);
  }

  const receipt = await publicClient.getTransactionReceipt({
    hash: DEPLOYMENT_TX_HASH,
  });

  return receipt.blockNumber;
}

async function getAidTraceLogs(fromBlock) {
  const latestBlock = await publicClient.getBlockNumber();
  const logs = [];

  for (let start = fromBlock; start <= latestBlock; start += LOG_BLOCK_STEP + 1n) {
    const end = start + LOG_BLOCK_STEP > latestBlock ? latestBlock : start + LOG_BLOCK_STEP;
    const chunk = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: aidTraceEvent,
      fromBlock: start,
      toBlock: end,
    });
    logs.push(...chunk);
  }

  return logs;
}

function hasSupabaseTimeline() {
  return TIMELINE_INDEX_ENABLED && Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function pageCursor(value) {
  const cursor = Number(value || 0);
  if (!Number.isFinite(cursor) || cursor < 0) return 0;
  return Math.floor(cursor);
}

function supabaseHeaders(prefer = "") {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders(options.prefer || ""),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase timeline error: ${response.status} ${text}`);
  }

  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function getIndexedState(defaultFromBlock) {
  const rows = await supabaseRequest(
    `aidtrace_timeline_state?contract_address=eq.${encodeURIComponent(NORMALIZED_CONTRACT_ADDRESS)}&select=last_indexed_block&limit=1`,
  );

  if (Array.isArray(rows) && rows[0]?.last_indexed_block != null) {
    return BigInt(rows[0].last_indexed_block);
  }

  return defaultFromBlock - 1n;
}

async function saveIndexedState(lastIndexedBlock) {
  await supabaseRequest("aidtrace_timeline_state?on_conflict=contract_address", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: JSON.stringify({
      contract_address: NORMALIZED_CONTRACT_ADDRESS,
      last_indexed_block: Number(lastIndexedBlock),
      updated_at: new Date().toISOString(),
    }),
  });
}

async function buildEventsFromLogs(logs) {
  const blockTimestampByNumber = new Map();

  return Promise.all(
    logs.map(async (log) => {
      if (!blockTimestampByNumber.has(log.blockNumber)) {
        const block = await publicClient.getBlock({
          blockNumber: log.blockNumber,
        });
        blockTimestampByNumber.set(log.blockNumber, new Date(Number(block.timestamp) * 1000).toISOString());
      }

      const txHash = log.transactionHash;
      const txUrl = `${CELOSCAN_TX_BASE}/${txHash}`;
      const reference = parseReferenceURI(log.args.referenceURI);

      return {
        id: `${txHash}-${log.logIndex}`,
        contractAddress: NORMALIZED_CONTRACT_ADDRESS,
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
        logIndex: Number(log.logIndex),
        blockTimestamp: blockTimestampByNumber.get(log.blockNumber),
      };
    }),
  );
}

function eventToTimelineRow(event) {
  return {
    id: event.id,
    contract_address: event.contractAddress,
    batch_id: event.batchId,
    action_type: event.actionType,
    sender: event.sender,
    data_hash: event.dataHash,
    reference_uri: event.referenceURI,
    source: event.source,
    details: event.details,
    status: event.status,
    tx_hash: event.txHash,
    tx_url: event.txUrl,
    qr_link: event.qrLink,
    block_number: event.blockNumber,
    log_index: event.logIndex,
    block_timestamp: event.blockTimestamp,
  };
}

function timelineRowToEvent(row) {
  return {
    id: row.id,
    batchId: row.batch_id,
    actionType: row.action_type,
    sender: row.sender,
    dataHash: row.data_hash,
    referenceURI: row.reference_uri,
    source: row.source,
    details: row.details,
    status: row.status,
    txHash: row.tx_hash,
    txUrl: row.tx_url,
    qrLink: row.qr_link,
    blockNumber: Number(row.block_number),
    logIndex: Number(row.log_index),
    blockTimestamp: row.block_timestamp,
  };
}

async function upsertIndexedEvents(events) {
  if (!events.length) return;

  await supabaseRequest("aidtrace_timeline_events?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: JSON.stringify(events.map(eventToTimelineRow)),
  });
}

async function loadIndexedTimeline(limit, cursor, batch = null) {
  let path = `aidtrace_timeline_events?contract_address=eq.${encodeURIComponent(NORMALIZED_CONTRACT_ADDRESS)}&select=*&order=block_number.desc,log_index.desc&limit=${limit + 1}&offset=${cursor}`;
  if (batch) path += `&batch_id=eq.${encodeURIComponent(batch)}`;
  const rows = await supabaseRequest(path);
  return Array.isArray(rows) ? rows.map(timelineRowToEvent) : [];
}

async function indexNewTimelineEvents(defaultFromBlock) {
  const latestBlock = await publicClient.getBlockNumber();
  const lastIndexedBlock = await getIndexedState(defaultFromBlock);
  const nextBlock = lastIndexedBlock + 1n;

  if (nextBlock > latestBlock) {
    return {
      indexed: 0,
      latestBlock: Number(latestBlock),
      lastIndexedBlock: Number(lastIndexedBlock),
    };
  }

  const logs = await getAidTraceLogs(nextBlock);
  const events = await buildEventsFromLogs(logs);
  await upsertIndexedEvents(events);
  await saveIndexedState(latestBlock);

  return {
    indexed: events.length,
    latestBlock: Number(latestBlock),
    lastIndexedBlock: Number(latestBlock),
  };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    const origin = requestOrigin(req);
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).send("Origin not allowed");
    }
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const origin = requestOrigin(req);
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const cursor = pageCursor(req.query.cursor);
    const batch = req.query.batch ? String(req.query.batch).toUpperCase() : null;
    const fromBlock = await timelineFromBlock();
    let events;
    let index = null;

    if (hasSupabaseTimeline()) {
      index = await indexNewTimelineEvents(fromBlock);
      events = await loadIndexedTimeline(limit, cursor, batch);
    } else {
      const logs = await getAidTraceLogs(fromBlock);
      const orderedEvents = (await buildEventsFromLogs(logs)).sort(
        (a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex,
      );
      const filtered = batch ? orderedEvents.filter((e) => e.batchId === batch) : orderedEvents;
      events = filtered.slice(cursor, cursor + limit + 1);
    }

    const hasMore = events.length > limit;
    const pageEvents = hasMore ? events.slice(0, limit) : events;

    return res.status(200).json({
      ok: true,
      contractAddress: CONTRACT_ADDRESS,
      indexed: Boolean(index),
      index,
      pagination: {
        limit,
        cursor,
        nextCursor: hasMore ? cursor + limit : null,
        hasMore,
      },
      events: pageEvents,
    });
  } catch (error) {
    console.error("Timeline error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Timeline error",
    });
  }
}
