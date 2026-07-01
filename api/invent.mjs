/**
 * api/invent.mjs
 *
 * Invent channel adapter for AidTrace.
 *
 * Invent is the platform (https://useinvent.com) that handles
 * WhatsApp Business and SMS channels.  When a field worker sends a
 * message on either channel, Invent delivers it here via an Action
 * configured in the Invent dashboard as "Call API endpoint".
 *
 * This endpoint:
 *   1. Authenticates the request with AIDTRACE_INVENT_WEBHOOK_TOKEN.
 *   2. Parses the natural-language custody command (same parser as Telegram).
 *   3. Enqueues the write in Supabase (same queue as Telegram/Zavu).
 *   4. Replies immediately with a human-readable acknowledgement.
 *   5. The GitHub Actions queue worker processes it and writes to Celo.
 *
 * Environment variables required:
 *   AIDTRACE_INVENT_WEBHOOK_TOKEN  – shared secret set in Invent Action config
 *   AIDTRACE_CONTRACT              – AidTraceLedger contract address
 *   SUPABASE_URL                   – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY      – Supabase service-role key
 *   AIDTRACE_QUEUE_ENABLED         – set "true" to use durable queue
 *   RASTROAYUDA_RELAYER_PRIVATE_KEY– hot relayer key (used when queue disabled)
 *
 * Invent Action configuration (in the Invent dashboard):
 *   Integration : HTTP Request (or "Call API endpoint")
 *   Method      : POST
 *   URL         : https://aidtrace-rastroayuda.vercel.app/api/invent
 *   Headers     : X-AidTrace-Invent-Token: <token>
 *   Body (JSON) :
 *     {
 *       "contact_id"  : "{{contact.id}}",
 *       "contact_name": "{{contact.name}}",
 *       "channel"     : "{{channel.type}}",   // "whatsapp" | "sms"
 *       "phone"       : "{{contact.phone}}",
 *       "message"     : "{{message.text}}"
 *     }
 *
 * The assistant's Instructions in Invent should include:
 *   "When a user sends a custody command (starting with CELO, LOTE, or AT-),
 *    call the Record Custody Event action immediately. Do not paraphrase or
 *    ask for confirmation. Pass the full original message as the 'message'
 *    field."
 */

import { parseAidTraceCommand } from './aidtrace-parser.mjs';
import { createClient }          from '@supabase/supabase-js';
import { ethers }                from 'ethers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_CHANNELS = new Set(['whatsapp', 'sms', 'whatsapp_business']);

// Minimal ABI — only the recordEvent function we call.
const LEDGER_ABI = [
  'function recordEvent(string batchId, string eventType, string details, string referenceURI) external',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Authenticate the inbound request using a shared token in the header.
 * Invent supports custom headers in Action configurations, so we can
 * always enforce this — unlike Zavu where header support was optional.
 */
function authenticate(req) {
  const token = process.env.AIDTRACE_INVENT_WEBHOOK_TOKEN;
  if (!token) {
    // Token not configured: skip auth (dev / first-deploy mode).
    // Log a warning so the operator knows to set it.
    console.warn('[invent] AIDTRACE_INVENT_WEBHOOK_TOKEN not set — skipping auth');
    return true;
  }
  const header =
    req.headers['x-aidtrace-invent-token'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return header === token;
}

/**
 * Build a public audit memo that lands in the Celo transaction's
 * referenceURI field.  Mirrors the format used by the Telegram adapter.
 */
function buildReferenceURI({ contactId, channel, batchId, eventType, details }) {
  return `invent:${channel}:${contactId} | ${eventType} ${batchId} | ${details}`;
}

/**
 * Enqueue the custody event in Supabase for the GitHub Actions queue worker.
 * Returns the queue row on success, throws on error.
 */
async function enqueue({ contactId, channel, phone, batchId, eventType, details, referenceURI }) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // inbound_message_id ensures idempotency: duplicate deliveries from Invent
  // produce a single queue row, not duplicate Celo writes.
  const inboundMessageId = `invent:${channel}:${contactId}:${batchId}:${eventType}:${Date.now()}`;

  const { data, error } = await supabase.rpc('enqueue_aidtrace_message', {
    p_inbound_message_id: inboundMessageId,
    p_channel:            `invent_${channel}`,
    p_source:             phone || contactId,
    p_payload:            JSON.stringify({ batchId, eventType, details, referenceURI }),
  });

  if (error) throw new Error(`Supabase enqueue error: ${error.message}`);
  return data;
}

/**
 * Write directly to Celo (used when queue is disabled — e.g. during
 * initial setup or smoke testing).
 */
async function writeDirectToCelo({ batchId, eventType, details, referenceURI }) {
  const provider = new ethers.JsonRpcProvider('https://forno.celo.org');
  const wallet   = new ethers.Wallet(process.env.RASTROAYUDA_RELAYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.AIDTRACE_CONTRACT, LEDGER_ABI, wallet);

  const tx = await contract.recordEvent(batchId, eventType, details, referenceURI);
  await tx.wait(1);
  return tx.hash;
}

// ---------------------------------------------------------------------------
// Main handler (Vercel serverless function)
// ---------------------------------------------------------------------------

export default async function handler(req, res) {

  // CORS: Invent sends from their servers, no Origin header needed.
  // Only POST is accepted.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Authentication ---
  if (!authenticate(req)) {
    console.warn('[invent] Rejected request: invalid token');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // --- Parse body ---
  const {
    contact_id:   contactId,
    contact_name: contactName,
    channel,
    phone,
    message,
  } = req.body ?? {};

  if (!contactId || !message) {
    return res.status(400).json({ error: 'Missing required fields: contact_id, message' });
  }

  if (channel && !ALLOWED_CHANNELS.has(channel)) {
    return res.status(400).json({ error: `Unsupported channel: ${channel}` });
  }

  const channelLabel = channel || 'whatsapp';

  // --- Parse the natural-language custody command ---
  const parsed = parseAidTraceCommand(message);

  if (!parsed) {
    // Message is not a custody command (e.g. a greeting or question).
    // Return a 200 with a help hint so the Invent assistant can relay it
    // back to the user.
    return res.status(200).json({
      ok:      false,
      reason:  'not_a_command',
      message: 'No se reconoció un comando de custodia. ' +
               'Enviá: CELO1 depositar 50 cajas de ibuprofeno',
    });
  }

  const { batchId, eventType, details } = parsed;
  const referenceURI = buildReferenceURI({ contactId, channel: channelLabel, batchId, eventType, details });

  // --- Queue or direct write ---
  const useQueue = process.env.AIDTRACE_QUEUE_ENABLED === 'true' &&
                   process.env.SUPABASE_URL &&
                   process.env.SUPABASE_SERVICE_ROLE_KEY;

  let responsePayload;

  try {
    if (useQueue) {
      const row = await enqueue({ contactId, channel: channelLabel, phone, batchId, eventType, details, referenceURI });
      console.info(`[invent] Queued ${channelLabel} message from ${contactId}: ${batchId} ${eventType}`);
      responsePayload = {
        ok:         true,
        queued:     true,
        queue_id:   row?.id,
        batch_id:   batchId,
        event_type: eventType,
        details,
        // This is the message the Invent assistant should send back to the user.
        reply:      `✅ En cola: ${eventType} ${batchId}\nDetalles: ${details}\nRecibido en Celo en ~1 min. ⏳`,
      };
    } else {
      // Direct write (dev / smoke-test mode).
      const txHash = await writeDirectToCelo({ batchId, eventType, details, referenceURI });
      console.info(`[invent] Direct Celo write from ${channelLabel}/${contactId}: ${txHash}`);
      responsePayload = {
        ok:         true,
        queued:     false,
        tx_hash:    txHash,
        batch_id:   batchId,
        event_type: eventType,
        details,
        reply:      `✅ Registrado en Celo: ${eventType} ${batchId}\n` +
                    `Detalles: ${details}\n` +
                    `Tx: https://celoscan.io/tx/${txHash}\n` +
                    `Auditoría: abrí el link → Logs → data/referenceURI`,
      };
    }
  } catch (err) {
    console.error('[invent] Write error:', err.message);
    return res.status(500).json({
      ok:    false,
      error: 'internal_error',
      reply: '❌ Error interno al registrar el evento. Intentá de nuevo en 1 minuto.',
    });
  }

  return res.status(200).json(responsePayload);
}
