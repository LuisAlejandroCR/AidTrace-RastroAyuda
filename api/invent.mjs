/**
 * api/invent.mjs  — Invent channel adapter (WhatsApp + SMS)
 *
 * DEPENDENCIES: only what is already in package.json
 *   viem  — Celo writes (same as zavu.mjs)
 *   fetch — built-in Node 18+, used for Supabase RPC (no @supabase/supabase-js needed)
 *
 * NO NEW PACKAGES REQUIRED. Drop this file into /api/ and redeploy.
 *
 * Invent Action configuration:
 *   URL    : https://aidtrace-rastroayuda.vercel.app/api/invent
 *   Method : POST          ← change from GET
 *   Headers: {"X-AidTrace-Invent-Token":"<your token>","Content-Type":"application/json"}
 *   Body   : {"contact_id":"{{contact.id}}","contact_name":"{{contact.name}}",
 *             "channel":"{{channel.type}}","phone":"{{contact.phone}}",
 *             "message":"{{message.text}}"}
 *              ← switch Body from "AI Controlled" to this exact raw JSON
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { parseAidTraceCommand } from './aidtrace-parser.mjs';

// ---------------------------------------------------------------------------
// Celo Mainnet config (mirrors zavu.mjs)
// ---------------------------------------------------------------------------

const celoMainnet = {
  id: 42220,
  name: 'Celo',
  network: 'celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
};

const LEDGER_ABI = [{
  name: 'recordEvent',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'batchId',      type: 'string' },
    { name: 'eventType',    type: 'string' },
    { name: 'details',      type: 'string' },
    { name: 'referenceURI', type: 'string' },
  ],
  outputs: [],
}];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authenticate(req) {
  const token = process.env.AIDTRACE_INVENT_WEBHOOK_TOKEN;
  if (!token) {
    console.warn('[invent] AIDTRACE_INVENT_WEBHOOK_TOKEN not set — running without auth');
    return true;
  }
  const header =
    req.headers['x-aidtrace-invent-token'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return header === token;
}

// ---------------------------------------------------------------------------
// Supabase queue — raw fetch, no SDK needed
// ---------------------------------------------------------------------------

async function enqueueSupabase({ contactId, channel, phone, batchId, eventType, details, referenceURI }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase env vars not set');

  const inboundMessageId = `invent:${channel}:${contactId}:${batchId}:${eventType}:${Date.now()}`;

  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/enqueue_aidtrace_message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      p_inbound_message_id: inboundMessageId,
      p_channel:            `invent_${channel}`,
      p_source:             phone || contactId,
      p_payload:            JSON.stringify({ batchId, eventType, details, referenceURI }),
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Supabase enqueue failed ${resp.status}: ${errText}`);
  }
  return resp.json().catch(() => null);
}

// ---------------------------------------------------------------------------
// Direct Celo write — viem (same pattern as zavu.mjs)
// ---------------------------------------------------------------------------

async function writeDirectToCelo({ batchId, eventType, details, referenceURI }) {
  const privateKey = process.env.RASTROAYUDA_RELAYER_PRIVATE_KEY;
  const contractAddress = process.env.AIDTRACE_CONTRACT;
  if (!privateKey || !contractAddress) throw new Error('Relayer env vars not set');

  const account = privateKeyToAccount(
    privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  );

  const walletClient = createWalletClient({
    account,
    chain: celoMainnet,
    transport: http('https://forno.celo.org'),
  });

  const publicClient = createPublicClient({
    chain: celoMainnet,
    transport: http('https://forno.celo.org'),
  });

  const data = encodeFunctionData({
    abi: LEDGER_ABI,
    functionName: 'recordEvent',
    args: [batchId, eventType, details, referenceURI],
  });

  const txHash = await walletClient.sendTransaction({
    to: contractAddress,
    data,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
  return txHash;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!authenticate(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    contact_id:   contactId,
    contact_name: contactName,
    channel,
    phone,
    message,
  } = req.body ?? {};

  if (!contactId || !message) {
    return res.status(400).json({
      error: 'Missing required fields: contact_id and message',
      received: { contactId: !!contactId, message: !!message },
    });
  }

  const channelLabel = (channel || 'whatsapp').toLowerCase();

  // Parse the custody command
  const parsed = parseAidTraceCommand(message);

  if (!parsed) {
    return res.status(200).json({
      ok:      false,
      reason:  'not_a_command',
      reply:   'No se reconoció un comando de custodia. Ejemplo: CELO1 entregar 50 cajas de agua',
    });
  }

  const { batchId, eventType, details } = parsed;
  const referenceURI = `invent:${channelLabel}:${contactId} | ${eventType} ${batchId} | ${details}`;

  const useQueue =
    process.env.AIDTRACE_QUEUE_ENABLED === 'true' &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    if (useQueue) {
      const row = await enqueueSupabase({ contactId, channel: channelLabel, phone, batchId, eventType, details, referenceURI });
      console.info(`[invent] Queued ${channelLabel}/${contactId}: ${batchId} ${eventType}`);
      return res.status(200).json({
        ok:         true,
        queued:     true,
        batch_id:   batchId,
        event_type: eventType,
        details,
        reply:      `En cola: ${eventType} ${batchId}\nDetalles: ${details}\nRecibido en Celo en ~1 min.`,
      });
    } else {
      const txHash = await writeDirectToCelo({ batchId, eventType, details, referenceURI });
      console.info(`[invent] Direct Celo write from ${channelLabel}/${contactId}: ${txHash}`);
      return res.status(200).json({
        ok:         true,
        queued:     false,
        tx_hash:    txHash,
        batch_id:   batchId,
        event_type: eventType,
        details,
        reply:
          `Registrado en Celo: ${eventType} ${batchId}\n` +
          `Detalles: ${details}\n` +
          `Tx: https://celoscan.io/tx/${txHash}`,
      });
    }
  } catch (err) {
    console.error('[invent] Error:', err.message);
    return res.status(500).json({
      ok:    false,
      error: 'internal_error',
      reply: 'Error al registrar el evento. Intentalo de nuevo en 1 minuto.',
    });
  }
}
