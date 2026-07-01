/**
 * api/invent.mjs  — Invent WhatsApp/SMS adapter
 * 
 * Self-contained. Zero imports. No dependencies.
 * Uses only Node.js built-ins available in Vercel's Node 18 runtime.
 */

const BATCH_ALIASES = {
  'celo1':     'AT-CELO-1',
  'celo 1':    'AT-CELO-1',
  'lote1':     'AT-CELO-1',
  'lote 1':    'AT-CELO-1',
  'at-celo-1': 'AT-CELO-1',
};

const EVENT_MAP = {
  depositar: 'DELIVER',
  entregar:  'DELIVER',
  recoger:   'PICKUP',
  recibir:   'PICKUP',
  revisar:   'REVIEW',
  reporte:   'REVIEW',
};

function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.trim().toLowerCase();

  let batchId = null;
  let rest = lower;

  for (const [alias, id] of Object.entries(BATCH_ALIASES)) {
    if (lower.startsWith(alias)) {
      batchId = id;
      rest = lower.slice(alias.length).trim();
      break;
    }
  }
  if (!batchId) return null;

  let eventType = null;
  for (const [word, type] of Object.entries(EVENT_MAP)) {
    if (rest.startsWith(word)) {
      eventType = type;
      rest = rest.slice(word.length).trim();
      break;
    }
  }
  if (!eventType) return null;

  return { batchId, eventType, details: rest || '(sin detalles)' };
}

async function enqueueSupabase(payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');

  const msgId = `invent:${payload.channel}:${payload.contactId}:${payload.batchId}:${Date.now()}`;
  const r = await fetch(`${url}/rest/v1/rpc/enqueue_aidtrace_message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      p_inbound_message_id: msgId,
      p_channel:            `invent_${payload.channel}`,
      p_source:             payload.phone || payload.contactId,
      p_payload:            JSON.stringify({
        batchId:      payload.batchId,
        eventType:    payload.eventType,
        details:      payload.details,
        referenceURI: payload.referenceURI,
      }),
    }),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json().catch(() => null);
}

async function writeToCelo({ batchId, eventType, details, referenceURI }) {
  // Dynamic import so the module-level crash cannot happen
  const viem = await import('viem');
  const viemAccounts = await import('viem/accounts');
  const viemChains = await import('viem/chains');

  const pk = process.env.RASTROAYUDA_RELAYER_PRIVATE_KEY;
  const addr = process.env.AIDTRACE_CONTRACT;
  if (!pk || !addr) throw new Error('Relayer env vars not configured');

  const account = viemAccounts.privateKeyToAccount(
    pk.startsWith('0x') ? pk : `0x${pk}`
  );

  const ABI = [{
    name: 'recordEvent', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId',      type: 'string' },
      { name: 'eventType',    type: 'string' },
      { name: 'details',      type: 'string' },
      { name: 'referenceURI', type: 'string' },
    ],
    outputs: [],
  }];

  const data = viem.encodeFunctionData({
    abi: ABI, functionName: 'recordEvent',
    args: [batchId, eventType, details, referenceURI],
  });

  const wallet = viem.createWalletClient({
    account, chain: viemChains.celo, transport: viem.http(),
  });
  const pubClient = viem.createPublicClient({
    chain: viemChains.celo, transport: viem.http(),
  });

  const hash = await wallet.sendTransaction({ to: addr, data });
  await pubClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  return hash;
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Method guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST, not ' + req.method });
  }

  // Auth
  const envToken = process.env.AIDTRACE_INVENT_WEBHOOK_TOKEN;
  if (envToken) {
    const sent =
      req.headers['x-aidtrace-invent-token'] ||
      (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (sent !== envToken) return res.status(401).json({ error: 'Unauthorized' });
  }

  // Parse body
  const body = req.body ?? {};
  const contactId = body.contact_id;
  const message   = body.message;
  const channel   = (body.channel || 'whatsapp').toLowerCase();
  const phone     = body.phone || '';

  if (!contactId || !message) {
    return res.status(400).json({
      error: 'Missing required fields',
      received_keys: Object.keys(body),
    });
  }

  // Parse custody command
  const parsed = parseCommand(message);
  if (!parsed) {
    return res.status(200).json({
      ok:     false,
      reason: 'not_a_command',
      reply:  'Comando no reconocido. Ejemplo: CELO1 entregar 50 cajas de agua',
    });
  }

  const { batchId, eventType, details } = parsed;
  const referenceURI = `invent:${channel}:${contactId} | ${eventType} ${batchId} | ${details}`;

  const useQueue =
    process.env.AIDTRACE_QUEUE_ENABLED === 'true' &&
    !!process.env.SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    if (useQueue) {
      await enqueueSupabase({ contactId, channel, phone, batchId, eventType, details, referenceURI });
      return res.status(200).json({
        ok: true, queued: true,
        batch_id: batchId, event_type: eventType, details,
        reply: `En cola: ${eventType} ${batchId}\n${details}\nCelo en ~1 min.`,
      });
    }

    const txHash = await writeToCelo({ batchId, eventType, details, referenceURI });
    return res.status(200).json({
      ok: true, queued: false, tx_hash: txHash,
      batch_id: batchId, event_type: eventType, details,
      reply:
        `Registrado en Celo: ${eventType} ${batchId}\n` +
        `${details}\n` +
        `Tx: https://celoscan.io/tx/${txHash}`,
    });

  } catch (err) {
    console.error('[invent]', err.message);
    return res.status(500).json({
      ok: false, error: err.message,
      reply: 'Error interno. Intenta en 1 minuto.',
    });
  }
}
