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
import { parseAidTraceText } from "../lib/aidtrace-parser.mjs";

const CONTRACT_ADDRESS =
  process.env.AIDTRACE_CONTRACT || "0xaf5c40e82ac9255479a1f447e81992b71c4f4934";
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const CELOSCAN_TX_BASE = process.env.CELOSCAN_TX_BASE || "https://celoscan.io/tx";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const CELO_WRITE_GAP_MS = Number(process.env.AIDTRACE_CELO_WRITE_GAP_MS || "1800");
const CELO_LOCK_WAIT_MS = Number(process.env.AIDTRACE_CELO_LOCK_WAIT_MS || "25000");
const CELO_LOCK_TTL_MS = Number(process.env.AIDTRACE_CELO_LOCK_TTL_MS || "45000");
const CELO_LOCK_POLL_MS = Number(process.env.AIDTRACE_CELO_LOCK_POLL_MS || "500");
const CELO_LOCK_KEY = process.env.AIDTRACE_CELO_LOCK_KEY || "aidtrace:celo-write-lock";
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_LOCK_ACQUIRE_RPC = process.env.AIDTRACE_SUPABASE_LOCK_ACQUIRE_RPC || "try_acquire_aidtrace_lock";
const SUPABASE_LOCK_RELEASE_RPC = process.env.AIDTRACE_SUPABASE_LOCK_RELEASE_RPC || "release_aidtrace_lock";
const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
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
const WEBHOOK_TOKEN = process.env.AIDTRACE_WEBHOOK_TOKEN || "";
const MAX_BROWSER_RELAY_ITEMS = Number(process.env.AIDTRACE_MAX_BROWSER_RELAY_ITEMS || "20");
const QUEUE_ENABLED = process.env.AIDTRACE_QUEUE_ENABLED === "true";
const BROWSER_QUEUE_ENABLED = process.env.AIDTRACE_BROWSER_QUEUE_ENABLED === "true";
const BROWSER_RELAY_GUARD_ENABLED = process.env.AIDTRACE_BROWSER_RELAY_GUARD_ENABLED === "true";
const BROWSER_RELAY_RATE_LIMIT = Number(process.env.AIDTRACE_BROWSER_RELAY_RATE_LIMIT || "30");
const QUEUE_WORKER_ID = process.env.AIDTRACE_QUEUE_WORKER_ID || "aidtrace-vercel-worker";
const QUEUE_PROCESS_ON_INBOUND = process.env.AIDTRACE_QUEUE_PROCESS_ON_INBOUND !== "false";
const QUEUE_INBOUND_PROCESS_LIMIT = Math.max(1, Number(process.env.AIDTRACE_QUEUE_INBOUND_PROCESS_LIMIT || "2"));
const CENTER_WEBHOOK_URL    = process.env.AIDTRACE_CENTER_WEBHOOK_URL    || "";
const CENTER_WEBHOOK_SECRET = process.env.AIDTRACE_CENTER_WEBHOOK_SECRET || "";
let celoWriteQueue = Promise.resolve();

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

function requestOrigin(req) {
  return String(req.headers.origin || "");
}

function requestIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const forwardedIp = forwardedFor.split(",")[0]?.trim();
  return (
    forwardedIp ||
    String(req.headers["x-real-ip"] || "") ||
    String(req.socket?.remoteAddress || "") ||
    "unknown"
  );
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AidTrace-Webhook-Token");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasValidWebhookToken(req) {
  if (!WEBHOOK_TOKEN) return true;

  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const explicit = String(req.headers["x-aidtrace-webhook-token"] || "");
  return bearer === WEBHOOK_TOKEN || explicit === WEBHOOK_TOKEN;
}

function validateTextField(value, label, maxLength) {
  if (value == null) return;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`Invalid ${label}`);
  }
}

function validateBrowserRelayPacket(packet) {
  if (!Array.isArray(packet.pending)) {
    throw new Error("Relay packet missing pending array");
  }

  if (packet.pending.length > MAX_BROWSER_RELAY_ITEMS) {
    throw new Error(`Relay packet too large. Max ${MAX_BROWSER_RELAY_ITEMS} events.`);
  }

  const seen = new Set();
  const allowedActions = new Set([
    "CREATED",
    "PICKED_UP",
    "ARRIVED",
    "DELIVERED",
    "DAMAGED",
    "NEEDS_REVIEW",
    "SMS_CONFIRMED",
  ]);

  for (const item of packet.pending) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid relay item");
    }

    validateTextField(item.id, "id", 120);
    validateTextField(item.batchId, "batchId", 64);
    validateTextField(item.actionType, "actionType", 40);
    validateTextField(item.senderName, "senderName", 120);
    validateTextField(item.locationText, "locationText", 160);
    validateTextField(item.note, "note", 500);
    validateTextField(item.ref, "ref", 300);

    if (!/^AT-[A-Z0-9-_]{1,56}$/i.test(item.batchId || "")) {
      throw new Error("Invalid batchId");
    }

    if (!allowedActions.has(String(item.actionType || "").toUpperCase())) {
      throw new Error("Invalid actionType");
    }

    const duplicateKey = item.id || `${item.batchId}:${item.actionType}:${item.note || item.locationText || ""}`;
    if (seen.has(duplicateKey)) {
      throw new Error("Duplicate relay item in packet");
    }
    seen.add(duplicateKey);
  }
}

function hasDistributedLock() {
  return Boolean((SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) || (REDIS_REST_URL && REDIS_REST_TOKEN));
}

function hasSupabaseLock() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(prefer = "") {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function supabaseRpc(name, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase RPC error: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function hasSupabaseQueue() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function hasBrowserRelayGuard() {
  return Boolean(BROWSER_RELAY_GUARD_ENABLED && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function beginBrowserRelayEvent(item, requesterIp) {
  const rows = await supabaseRpc("begin_aidtrace_browser_relay_event", {
    p_event_id: item.id,
    p_batch_id: String(item.batchId || "").toUpperCase(),
    p_action_type: String(item.actionType || "").toUpperCase(),
    p_requester_ip: requesterIp,
    p_rate_limit: BROWSER_RELAY_RATE_LIMIT,
  });

  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function completeBrowserRelayEvent(eventId, txHash) {
  if (!eventId) return null;
  return supabaseRpc("complete_aidtrace_browser_relay_event", {
    p_event_id: eventId,
    p_tx_hash: txHash,
  });
}

async function failBrowserRelayEvent(eventId, error) {
  if (!eventId) return null;
  return supabaseRpc("fail_aidtrace_browser_relay_event", {
    p_event_id: eventId,
    p_error: String(error?.message || error || "unknown error"),
  });
}

async function enqueueAidTraceMessage({ inboundMessageId, source, channel, recipient, parsed, payload }) {
  if (!hasSupabaseQueue()) {
    throw new Error("Missing Supabase queue configuration");
  }

  return supabaseRpc("enqueue_aidtrace_message", {
    p_inbound_message_id: inboundMessageId,
    p_source: source,
    p_channel: channel,
    p_recipient: recipient || null,
    p_batch_id: parsed?.batchId || null,
    p_action_type: parsed?.actionType || null,
    p_details: parsed?.details || null,
    p_payload: payload || {},
  });
}

export async function claimAidTraceMessage(workerId = QUEUE_WORKER_ID) {
  const rows = await supabaseRpc("claim_aidtrace_message", {
    p_worker_id: workerId,
    p_lock_seconds: Number(process.env.AIDTRACE_QUEUE_LOCK_SECONDS || "120"),
  });

  return Array.isArray(rows) ? rows[0] || null : rows;
}

export async function completeAidTraceMessage(id, txHash) {
  return supabaseRpc("complete_aidtrace_message", {
    p_id: id,
    p_tx_hash: txHash,
  });
}

export async function retryAidTraceMessage(id, error, retrySeconds = 30) {
  return supabaseRpc("retry_aidtrace_message", {
    p_id: id,
    p_error: String(error?.message || error || "unknown error"),
    p_retry_seconds: retrySeconds,
    p_max_attempts: Number(process.env.AIDTRACE_QUEUE_MAX_ATTEMPTS || "8"),
  });
}

async function tryAcquireSupabaseLock(lockValue) {
  const acquired = await supabaseRpc(SUPABASE_LOCK_ACQUIRE_RPC, {
    p_lock_key: CELO_LOCK_KEY,
    p_lock_value: lockValue,
    p_ttl_ms: CELO_LOCK_TTL_MS,
  });

  return acquired === true;
}

async function acquireSupabaseLock() {
  const lockValue = randomUUID();
  const deadline = Date.now() + CELO_LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    if (await tryAcquireSupabaseLock(lockValue)) return lockValue;
    await sleep(CELO_LOCK_POLL_MS);
  }

  throw new Error("Celo write queue is busy. Try again in a few seconds.");
}

async function releaseSupabaseLock(lockValue) {
  if (!lockValue) return;
  await supabaseRpc(SUPABASE_LOCK_RELEASE_RPC, {
    p_lock_key: CELO_LOCK_KEY,
    p_lock_value: lockValue,
  });
}

function hasRedisLock() {
  return Boolean(REDIS_REST_URL && REDIS_REST_TOKEN);
}

async function redisCommand(command) {
  const response = await fetch(REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Redis lock error: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`Redis lock error: ${payload.error}`);
  }

  return payload.result;
}

async function acquireDistributedLock() {
  if (hasSupabaseLock()) {
    return { provider: "supabase", value: await acquireSupabaseLock() };
  }

  if (!hasRedisLock()) return null;

  const lockValue = randomUUID();
  const deadline = Date.now() + CELO_LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    const result = await redisCommand(["SET", CELO_LOCK_KEY, lockValue, "NX", "PX", CELO_LOCK_TTL_MS]);
    if (result === "OK") return { provider: "redis", value: lockValue };
    await sleep(CELO_LOCK_POLL_MS);
  }

  throw new Error("Celo write queue is busy. Try again in a few seconds.");
}

async function releaseDistributedLock(lock) {
  if (!lock) return;

  if (lock.provider === "supabase") {
    await releaseSupabaseLock(lock.value);
    return;
  }

  if (lock.provider !== "redis" || !hasRedisLock()) return;

  const releaseScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;

  await redisCommand(["EVAL", releaseScript, "1", CELO_LOCK_KEY, lock.value]);
}

async function enqueueCeloWrite(work) {
  const queued = celoWriteQueue.then(async () => {
    const lockValue = await acquireDistributedLock();
    try {
      const result = await work();
      await sleep(CELO_WRITE_GAP_MS);
      return result;
    } finally {
      try {
        await releaseDistributedLock(lockValue);
      } catch (error) {
        console.error("Celo lock release failed:", error);
      }
    }
  });

  celoWriteQueue = queued.catch(() => {});
  return queued;
}

function bytes32Text(value) {
  return stringToHex(String(value).toUpperCase().slice(0, 31), { size: 32 });
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

function publicAuditText(value) {
  return String(value || "sin detalles")
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function buildReferenceURI(source, messageId, parsed, explicitReferenceURI) {
  const base = explicitReferenceURI || `${source}:${messageId}`;
  return `${base} | ${parsed.actionType} ${parsed.batchId} | ${publicAuditText(parsed.details)}`;
}

export async function recordOnCelo(event, data, parsed, options = {}) {
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
      buildReferenceURI(source, messageId, parsed, options.referenceURI),
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

async function handleBrowserRelay(packet, req, res) {
  try {
    validateBrowserRelayPacket(packet);
  } catch (error) {
    console.error("Invalid browser relay packet:", error);
    return res.status(400).json({ ok: false, error: "Invalid relay packet" });
  }

  const pending = Array.isArray(packet.pending) ? packet.pending : [];
  const recorded = [];
  const failed = [];
  const queued = [];
  const requesterIp = requestIp(req);
  const relayGuardEnabled = hasBrowserRelayGuard();

  for (const item of pending) {
    let guardStarted = false;
    try {
      const parsed = relayEventToParsed(item);
      if (relayGuardEnabled) {
        const guard = await beginBrowserRelayEvent(item, requesterIp);
        if (guard?.duplicate) {
          if (guard.tx_hash) {
            recorded.push({
              id: item.id,
              batchId: parsed.batchId,
              actionType: parsed.actionType,
              txHash: guard.tx_hash,
              duplicate: true,
            });
          } else {
            queued.push({
              id: item.id,
              batchId: parsed.batchId,
              actionType: parsed.actionType,
              duplicate: true,
            });
          }
          continue;
        }

        if (guard?.rate_limited) {
          failed.push({
            id: item.id,
            batchId: parsed.batchId,
            actionType: parsed.actionType,
            error: "Relay rate limit exceeded",
          });
          continue;
        }

        guardStarted = Boolean(guard?.accepted);
      }

      if (QUEUE_ENABLED && BROWSER_QUEUE_ENABLED) {
        const messageId = item.id || randomUUID();
        const queueId = await enqueueAidTraceMessage({
          inboundMessageId: `browser:${messageId}`,
          source: "browser",
          channel: "browser",
          recipient: null,
          parsed,
          payload: {
            event: { id: messageId },
            data: {
              channel: "browser",
              from: item.senderName || "AidTrace browser",
              messageId,
            },
            parsed,
            options: {
              source: "browser",
              messageId,
              referenceURI: item.ref || `aidtrace:${parsed.batchId}`,
              extraData: item,
            },
          },
        });

        queued.push({
          id: item.id,
          queueId,
          batchId: parsed.batchId,
          actionType: parsed.actionType,
        });
        continue;
      }

      const result = await enqueueCeloWrite(() =>
        recordOnCelo(
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
        ),
      );

      recorded.push({
        id: item.id,
        batchId: parsed.batchId,
        actionType: parsed.actionType,
        txHash: result.txHash,
      });
      emitCenterDelivery({ batchId: parsed.batchId, actionType: parsed.actionType, details: parsed.details, locationText: item.locationText, txHash: result.txHash }).catch(() => {});

      if (guardStarted) {
        await completeBrowserRelayEvent(item.id, result.txHash);
      }
    } catch (error) {
      console.error("Browser relay item failed:", item?.id, error);
      if (guardStarted) {
        try {
          await failBrowserRelayEvent(item.id, error);
        } catch (guardError) {
          console.error("Browser relay guard fail update failed:", item?.id, guardError);
        }
      }
      failed.push({
        id: item?.id,
        batchId: item?.batchId,
        actionType: item?.actionType,
        error: "Relay item failed",
      });
    }
  }

  return res.status(failed.length ? 207 : 200).json({
    ok: failed.length === 0,
    queued,
    recorded,
    failed,
  });
}

export function buildSuccessReply(parsed, txHash) {
  return [
    `Registrado en Celo: ${parsed.actionType} ${parsed.batchId}`,
    `Detalles: ${parsed.details}`,
    `Tx: ${CELOSCAN_TX_BASE}/${txHash}`,
    "Auditoria: abre el link, ve a Logs y baja hasta data / referenceURI.",
  ].join("\n");
}

const CENTER_CODE_RE = /\b((?:CENTRO|CENTER|CC|DIST)-[\w-]{2,30})\b/i;
const CENTER_DELIVERY_ACTIONS = new Set(["DELIVERED", "DELIVER", "ARRIVED"]);

function parseCenterCode(...texts) {
  for (const text of texts) {
    const m = String(text || "").match(CENTER_CODE_RE);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

async function emitCenterDelivery({ batchId, actionType, details, locationText, txHash }) {
  if (!CENTER_DELIVERY_ACTIONS.has(String(actionType || "").toUpperCase())) return;
  const centerCode = parseCenterCode(details, locationText, batchId);
  if (!centerCode) return;

  const payload = {
    event:      "center.delivery",
    centerCode,
    batchId:    String(batchId || ""),
    actionType: String(actionType || "").toUpperCase(),
    details:    String(details || ""),
    txHash:     txHash || null,
    recordedAt: new Date().toISOString(),
  };

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_center_delivery`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          apikey:          SUPABASE_SERVICE_ROLE_KEY,
          Authorization:   `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_center_code:  centerCode,
          p_batch_id:     payload.batchId,
          p_action_type:  payload.actionType,
          p_details:      payload.details,
          p_tx_hash:      payload.txHash,
        }),
      });
      if (!r.ok) console.warn("[center] Supabase upsert status:", r.status);
      else console.info("[center] delivery recorded:", centerCode, batchId);
    } catch (err) {
      console.warn("[center] Supabase write failed:", err.message);
    }
  }

  if (CENTER_WEBHOOK_URL) {
    try {
      await fetch(CENTER_WEBHOOK_URL, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(CENTER_WEBHOOK_SECRET && { Authorization: `Bearer ${CENTER_WEBHOOK_SECRET}` }),
        },
        body:    JSON.stringify(payload),
      });
      console.info("[center] webhook emitted:", centerCode);
    } catch (err) {
      console.warn("[center] webhook failed:", err.message);
    }
  }
}

async function _processInventQueueRow(row) {
  const p = row.payload || {};
  const batchId      = p.batchId      || row.batch_id    || "UNKNOWN";
  const eventType    = p.eventType    || row.action_type || "DELIVER";
  const details      = p.details      || row.details     || "sin detalles";
  const referenceURI = p.referenceURI || "";
  const chatId       = p.chatId       || null;
  const channelType  = String(row.channel || "").replace("invent_", "");

  const parsed  = { actionType: eventType, batchId, details };
  const data    = { channel: row.channel, from: row.source, messageId: row.inbound_message_id };
  const event   = { id: row.inbound_message_id };
  const options = { source: "invent", messageId: row.inbound_message_id, referenceURI };

  try {
    const result = await enqueueCeloWrite(() => recordOnCelo(event, data, parsed, options));
    await completeAidTraceMessage(row.id, result.txHash);
    emitCenterDelivery({ batchId, actionType: eventType, details, locationText: "", txHash: result.txHash }).catch(() => {});

    if (chatId && process.env.AIDTRACE_INVENT_API_KEY) {
      try {
        const { sendInventReply, buildFinalReply } = await import("../lib/invent-notify.mjs");
        const text = buildFinalReply({ batchId, eventType, details, txHash: result.txHash, channel: channelType });
        await sendInventReply({ chatId, text });
        console.info("[invent] reply sent to chat", chatId);
      } catch (replyErr) {
        console.warn("[invent] WhatsApp reply failed, trying Telegram fallback:", replyErr.message);
        const fallbackChat = process.env.AIDTRACE_INVENT_FALLBACK_ZAVU_CHAT;
        if (fallbackChat) {
          try {
            await zavu.messages.send({
              to: fallbackChat,
              channel: "telegram",
              text: buildSuccessReply({ actionType: eventType, batchId, details }, result.txHash),
              idempotencyKey: `aidtrace-invent-fallback-${row.inbound_message_id}`,
            });
            console.info("[invent] Telegram fallback sent to", fallbackChat);
          } catch (fallbackErr) {
            console.warn("[invent] Telegram fallback also failed:", fallbackErr.message);
          }
        }
      }
    }

    return { ok: true, processed: true, id: row.id, txHash: result.txHash };
  } catch (error) {
    console.error("[invent] queue row failed:", row.id, error);
    await retryAidTraceMessage(row.id, error);
    return { ok: false, processed: true, id: row.id, error: "Invent message failed" };
  }
}

export async function processQueuedAidTraceMessage(workerId = QUEUE_WORKER_ID) {
  const row = await claimAidTraceMessage(workerId);
  if (!row) return { ok: true, processed: false };

  if (row.channel?.startsWith("invent_")) {
    return _processInventQueueRow(row);
  }

  try {
    const payload = row.payload || {};
    const parsed = payload.parsed || {
      actionType: row.action_type,
      batchId: row.batch_id,
      details: row.details || "sin detalles",
    };
    const data = payload.data || {
      channel: row.channel,
      from: row.recipient,
      messageId: row.inbound_message_id,
    };
    const event = payload.event || { id: row.inbound_message_id };
    const options = payload.options || {
      source: row.source,
      messageId: row.inbound_message_id,
    };

    const result = await enqueueCeloWrite(() => recordOnCelo(event, data, parsed, options));
    await completeAidTraceMessage(row.id, result.txHash);
    emitCenterDelivery({ batchId: parsed.batchId, actionType: parsed.actionType, details: parsed.details, locationText: "", txHash: result.txHash }).catch(() => {});

    if (payload.replyTo && payload.replyChannel) {
      await zavu.messages.send({
        to: payload.replyTo,
        channel: payload.replyChannel,
        text: buildSuccessReply(parsed, result.txHash),
        idempotencyKey: `aidtrace-final-${row.inbound_message_id}`,
      });
    }

    return {
      ok: true,
      processed: true,
      id: row.id,
      txHash: result.txHash,
    };
  } catch (error) {
    console.error("Queued AidTrace message failed:", row.id, error);
    await retryAidTraceMessage(row.id, error);
    return {
      ok: false,
      processed: true,
      id: row.id,
      error: "Queued message failed",
    };
  }
}

async function processInboundQueueKick(messageId) {
  if (!QUEUE_PROCESS_ON_INBOUND) return;

  const workerId = `aidtrace-zavu-kick-${messageId || randomUUID()}`;
  for (let index = 0; index < QUEUE_INBOUND_PROCESS_LIMIT; index += 1) {
    const result = await processQueuedAidTraceMessage(workerId);
    if (!result.processed) break;
    if (!result.ok) break;
  }
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

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const origin = requestOrigin(req);
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  try {
    const event = req.body || {};

    console.log("Zavu event:", JSON.stringify(event, null, 2));

    if (event.schema === "aidtrace.relay.v1") {
      return handleBrowserRelay(event, req, res);
    }

    if (event.type !== "message.inbound") {
      console.warn("Rejected unsupported Zavu event shape");
      return res.status(400).json({ ok: false, error: "Unsupported event" });
    }

    if (!hasValidWebhookToken(req)) {
      return res.status(401).send("Unauthorized");
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
    let queuedMessageId = "";

    try {
      parsed = parseAidTraceText(data.text);
      const messageId = getMessageId(event, data);

      if (QUEUE_ENABLED) {
        await enqueueAidTraceMessage({
          inboundMessageId: `zavu:${messageId}`,
          source: "zavu",
          channel,
          recipient: to,
          parsed,
          payload: {
            event,
            data,
            parsed,
            options: {
              source: "zavu",
              messageId,
            },
            replyTo: to,
            replyChannel: channel,
          },
        });
        replyText = [
          `Recibido en cola: ${parsed.actionType} ${parsed.batchId}`,
          `Detalles: ${parsed.details}`,
          "AidTrace lo registrara en Celo y enviara el link de auditoria.",
        ].join("\n");
        idempotencyKey = `aidtrace-queued-${messageId}`;
        queuedMessageId = messageId;
      } else {
        const { messageId, txHash } = await enqueueCeloWrite(() => recordOnCelo(event, data, parsed));
        emitCenterDelivery({ batchId: parsed.batchId, actionType: parsed.actionType, details: parsed.details, locationText: "", txHash }).catch(() => {});
        replyText = buildSuccessReply(parsed, txHash);
        idempotencyKey = `aidtrace-reply-${messageId}`;
      }
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

    if (queuedMessageId) {
      await processInboundQueueKick(queuedMessageId).catch((error) => {
        console.error("Inbound queue kick failed:", error);
      });
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).send("Webhook error");
  }
}
