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

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    throw new Error(`Supabase lock error: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
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

const ACTION_ALIASES = {
  PICKUP: "PICKUP",
  PICKED_UP: "PICKUP",
  RECOGER: "PICKUP",
  RECOGIDO: "PICKUP",
  RETIRO: "PICKUP",
  RECIBIR: "PICKUP",
  RECIBIDO: "PICKUP",
  DELIVER: "DELIVER",
  DELIVERED: "DELIVER",
  DELIVERY: "DELIVER",
  ENTREGAR: "DELIVER",
  ENTREGADO: "DELIVER",
  ENTREGA: "DELIVER",
  DEPOSITAR: "DELIVER",
  DEPOSITADO: "DELIVER",
  DEPOSITO: "DELIVER",
  LLEVAR: "DELIVER",
  LLEVADO: "DELIVER",
  REVIEW: "REVIEW",
  REVISAR: "REVIEW",
  REVISION: "REVIEW",
  REVISADO: "REVIEW",
  REPORTE: "REVIEW",
};

const COMMAND_PREFIXES = new Set(["AT", "AIDTRACE", "RASTROAYUDA", "RASTRO"]);
const HELP_WORDS = new Set(["HELP", "AYUDA", "START", "INICIO"]);
const BATCH_ALIAS_PREFIX = process.env.AIDTRACE_ALIAS_PREFIX || "AT-CELO";
const ALIAS_WORDS = new Set(["CELO", "LOTE", "BATCH"]);

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
    "Formato no reconocido o falta la clave del lote.",
    "Ejemplo: CELO1 depositar 100 aguas refugio mayor",
    "CELO1 es la clave del lote; 100 aguas queda como detalle.",
    "Tambien: LOTE 1 entregar 15 kits refugio mayor",
    "Acciones: recoger, entregar/depositar, revisar",
  ].join("\n");
}

function aliasToBatchId(value, nextValue = "") {
  const normalized = normalizeCommandPart(value).replace(/^#/, "");
  const compact = normalized.match(/^(CELO|LOTE|BATCH)-?#?(\d{1,6})$/);

  if (compact) {
    return { batchId: `${BATCH_ALIAS_PREFIX}-${Number(compact[2])}`, width: 1 };
  }

  const nextNumber = normalizeCommandPart(nextValue).replace(/^#/, "");
  if (ALIAS_WORDS.has(normalized) && /^\d{1,6}$/.test(nextNumber)) {
    return { batchId: `${BATCH_ALIAS_PREFIX}-${Number(nextNumber)}`, width: 2 };
  }

  return null;
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

  const actionIndex = parts.findIndex((part) => ACTION_ALIASES[normalizeCommandPart(part)]);
  const batchIndex = parts.findIndex((part) => /^AT-[A-Z0-9-_]+$/i.test(part));
  const aliasIndex = parts.findIndex((part, index) => aliasToBatchId(part, parts[index + 1]));
  const aliasMatch = aliasIndex >= 0 ? aliasToBatchId(parts[aliasIndex], parts[aliasIndex + 1]) : null;
  const aliasIndexes = aliasMatch
    ? new Set(Array.from({ length: aliasMatch.width }, (_, offset) => aliasIndex + offset))
    : new Set();
  const actionType = actionIndex >= 0 ? ACTION_ALIASES[normalizeCommandPart(parts[actionIndex])] : null;
  const batchId = batchIndex >= 0
    ? parts[batchIndex]
    : aliasMatch?.batchId || null;

  if (!actionType || !batchId) {
    throw new Error(usageMessage());
  }

  const details = parts
    .filter((_, index) => index !== actionIndex && index !== batchIndex && !aliasIndexes.has(index))
    .join(" ");

  return {
    actionType,
    batchId: batchId.toUpperCase(),
    details: details || "sin detalles",
    alias: aliasMatch ? parts.slice(aliasIndex, aliasIndex + aliasMatch.width).join(" ").toUpperCase() : undefined,
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

async function handleBrowserRelay(packet, res) {
  const pending = Array.isArray(packet.pending) ? packet.pending : [];
  const recorded = [];
  const failed = [];

  for (const item of pending) {
    try {
      const parsed = relayEventToParsed(item);
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
    } catch (error) {
      console.error("Browser relay item failed:", item?.id, error);
      failed.push({
        id: item?.id,
        batchId: item?.batchId,
        actionType: item?.actionType,
        error: error.message || "Relay item failed",
      });
    }
  }

  return res.status(failed.length ? 207 : 200).json({
    ok: failed.length === 0,
    recorded,
    failed,
  });
}

function buildSuccessReply(parsed, txHash) {
  return [
    `Registrado en Celo: ${parsed.actionType} ${parsed.batchId}`,
    `Detalles: ${parsed.details}`,
    `Tx: ${CELOSCAN_TX_BASE}/${txHash}`,
    "Auditoria: abre el link, ve a Logs y baja hasta data / referenceURI.",
  ].join("\n");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

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
      const { messageId, txHash } = await enqueueCeloWrite(() => recordOnCelo(event, data, parsed));
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
