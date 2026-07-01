/**
 * api/invent-notify.mjs
 *
 * Outbound Invent notifier — called by the queue worker (api/process-queue.mjs)
 * after a Celo write succeeds to deliver the final tx-hash reply to the user
 * on WhatsApp or SMS via the Invent API.
 *
 * This mirrors how api/zavu.mjs sends the final Telegram reply after queueing.
 *
 * Invent API endpoint used:
 *   POST /orgs/c/contacts/{contact_id}/channels/{channel_id}/messages
 *   — "Send a message as a contact on a channel" (used for outbound business reply)
 *
 * Actually we use:
 *   POST /orgs/c/chats/{chat_id}/messages
 *   — "Create Chat Message" to post the reply in the existing conversation.
 *
 * The chat_id and contact_id are stored in the Supabase queue row payload
 * when the inbound message is enqueued by api/invent.mjs.
 *
 * Environment variables required:
 *   AIDTRACE_INVENT_API_KEY  – Invent API key (Settings → API Keys)
 */

const INVENT_API_BASE = 'https://api.useinvent.com';

/**
 * Send a text reply to a conversation in Invent.
 *
 * @param {object} opts
 * @param {string} opts.chatId      – Invent conversation/chat ID
 * @param {string} opts.text        – Message text to deliver
 * @returns {Promise<object>}       – Invent API response
 */
export async function sendInventReply({ chatId, text }) {
  const apiKey = process.env.AIDTRACE_INVENT_API_KEY;
  if (!apiKey) {
    throw new Error('AIDTRACE_INVENT_API_KEY not configured');
  }

  const url  = `${INVENT_API_BASE}/orgs/c/chats/${chatId}/messages`;
  const body = JSON.stringify({ text });

  const response = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '(no body)');
    throw new Error(`Invent API error ${response.status}: ${errText}`);
  }

  return response.json();
}

/**
 * Build the final success reply text that gets sent to the user on
 * WhatsApp or SMS after the Celo write completes.
 *
 * @param {object} opts
 * @param {string} opts.batchId
 * @param {string} opts.eventType
 * @param {string} opts.details
 * @param {string} opts.txHash
 * @param {string} opts.channel  – 'whatsapp' | 'sms'
 * @returns {string}
 */
export function buildFinalReply({ batchId, eventType, details, txHash, channel }) {
  const celoscanUrl = `https://celoscan.io/tx/${txHash}`;

  if (channel === 'sms') {
    // SMS: keep it short (160 chars).
    return `AidTrace OK: ${eventType} ${batchId}. Tx: ${celoscanUrl}`;
  }

  // WhatsApp: full reply with emoji and audit instructions.
  return (
    `✅ *Registrado en Celo*: ${eventType} ${batchId}\n` +
    `📦 Detalles: ${details}\n` +
    `🔗 Tx: ${celoscanUrl}\n` +
    `🔍 Auditoría: abrí el link → Logs → data / referenceURI`
  );
}
