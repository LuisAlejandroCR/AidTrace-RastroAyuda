/**
 * api/process-queue.mjs  — DIFF / PATCH GUIDE
 *
 * This file shows only the changes needed to the existing process-queue.mjs
 * to support Invent (WhatsApp / SMS) payloads.
 *
 * Three things to add:
 *   1. Import sendInventReply and buildFinalReply from invent-notify.mjs
 *   2. Add a processInventRow() function that mirrors processZavuRow()
 *   3. Route rows with channel starting with "invent_" to processInventRow()
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ADD at the top of process-queue.mjs (with existing imports):
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   import { sendInventReply, buildFinalReply } from './invent-notify.mjs';
 *
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ADD this function anywhere before the main processRow() dispatcher:
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Process a single Invent (WhatsApp / SMS) queue row.
 *
 * The row.payload shape written by api/invent.mjs:
 *   {
 *     batchId:      "AT-CELO-1",
 *     eventType:    "DELIVER",
 *     details:      "100 aguas refugio mayor",
 *     referenceURI: "invent:whatsapp:contact_id | DELIVER AT-CELO-1 | ...",
 *     chatId:       "chat_xyz"    // optional — present when Invent includes it
 *   }
 */
export async function processInventRow(row, { contract, supabase }) {
  const { batchId, eventType, details, referenceURI, chatId } = JSON.parse(row.payload);

  // Write to Celo — same as every other channel.
  const tx = await contract.recordEvent(batchId, eventType, details, referenceURI);
  await tx.wait(1);
  const txHash = tx.hash;

  console.info(`[process-queue] Invent Celo write OK: ${txHash} for ${row.channel}/${row.source}`);

  // Update queue row with tx hash.
  await supabase
    .from('aidtrace_message_queue')
    .update({ status: 'completed', tx_hash: txHash })
    .eq('id', row.id);

  // Send the final reply back to the user on WhatsApp or SMS (if chatId is available).
  if (chatId && process.env.AIDTRACE_INVENT_API_KEY) {
    const channel = row.channel.replace('invent_', ''); // 'whatsapp' | 'sms'
    const replyText = buildFinalReply({ batchId, eventType, details, txHash, channel });
    try {
      await sendInventReply({ chatId, text: replyText });
      console.info(`[process-queue] Invent reply sent to chat ${chatId}`);
    } catch (replyErr) {
      // Non-fatal: Celo write succeeded; reply failure is logged but not retried here.
      console.warn(`[process-queue] Invent reply failed: ${replyErr.message}`);
    }
  }

  return txHash;
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 * MODIFY the existing processRow() dispatcher in process-queue.mjs:
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Find the section that routes by row.channel (it currently handles
 * "telegram" / "zavu" / "browser").  Add the Invent branch:
 *
 *   if (row.channel.startsWith('invent_')) {
 *     txHash = await processInventRow(row, { contract, supabase });
 *   } else if (row.channel === 'telegram' || row.channel === 'zavu') {
 *     txHash = await processZavuRow(row, { contract, supabase });
 *   } else {
 *     // browser relay or unknown — existing logic
 *     txHash = await processBrowserRow(row, { contract, supabase });
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────
 * That is the complete change.  No other files need to change.
 * ─────────────────────────────────────────────────────────────────────────
 */
