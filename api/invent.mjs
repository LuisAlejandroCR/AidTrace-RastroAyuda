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

async function enqueueSupabase({ contactId, chatId, channel, phone, batchId, eventType, details, referenceURI }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');

  const providerMessageId = body.message_id || body.id;
  const msgId = providerMessageId
    ? `invent:${String(providerMessageId).slice(0, 120)}`
    : `invent:${channel}:${contactId}:${batchId}:${eventType}:${details.slice(0, 120)}`;
  const r = await fetch(`${url}/rest/v1/rpc/enqueue_aidtrace_message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      p_inbound_message_id: msgId,
      p_source:             phone || contactId,
      p_channel:            `invent_${channel}`,
      p_recipient:          contactId,
      p_batch_id:           batchId,
      p_action_type:        eventType,
      p_details:            details,
      p_payload: {
        batchId, eventType, details, referenceURI,
        chatId: chatId || null,
      },
    }),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json().catch(() => null);
}

async function writeToCelo({ batchId, eventType, details, referenceURI }) {
  void batchId; void eventType; void details; void referenceURI;
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Method guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST, not ' + req.method });
  }

  // Auth — fail closed: the webhook must be configured with a shared token
  const envToken = process.env.AIDTRACE_INVENT_WEBHOOK_TOKEN;
  if (!envToken) {
    return res.status(503).json({ error: 'Invent webhook token not configured' });
  }
  const sent =
    req.headers['x-aidtrace-invent-token'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (typeof sent !== 'string' || sent !== envToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Parse body
  const body = req.body ?? {};
  const contactId = body.contact_id;
  const chatId    = body.chat_id || '';
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

  const { batchId, eventType, details: rawDetails } = parsed;
  const details = String(rawDetails || '').slice(0, 500);
  const referenceURI = `invent:${channel}:${contactId} | ${eventType} ${batchId} | ${details}`;

  const useQueue =
    process.env.AIDTRACE_QUEUE_ENABLED === 'true' &&
    !!process.env.SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!useQueue) {
    return res.status(503).json({ ok: false, error: 'Queue not configured' });
  }

  try {
    await enqueueSupabase({ contactId, chatId, channel, phone, batchId, eventType, details, referenceURI });
    return res.status(200).json({
      ok: true, queued: true,
      batch_id: batchId, event_type: eventType, details,
      reply: `En cola: ${eventType} ${batchId}\n${details}\nCelo en ~1 min.`,
    });
  } catch (err) {
    console.error('[invent]', err.message);
    return res.status(500).json({
      ok: false, error: 'Invent message failed',
      reply: 'Error interno. Intenta en 1 minuto.',
    });
  }
}
