/**
 * api/center-webhook.mjs — AidTrace center delivery webhook receiver
 *
 * Point AIDTRACE_CENTER_WEBHOOK_URL at this endpoint so center deliveries
 * loop back and trigger a Telegram notification to the center coordinator.
 *
 *   AIDTRACE_CENTER_WEBHOOK_URL    = https://<app>/api/center-webhook
 *   AIDTRACE_CENTER_WEBHOOK_SECRET = <random string — same on sender + receiver>
 *   AIDTRACE_CENTER_NOTIFY_CHAT    = <Zavu Telegram chat ID to notify>
 *
 * How to get AIDTRACE_CENTER_NOTIFY_CHAT:
 *   Zavu dashboard → Conversations → send any message to the AidTrace bot
 *   from the coordinator account → copy the chat ID from the conversation URL.
 *
 * How to get AIDTRACE_CENTER_WEBHOOK_SECRET:
 *   Generate any random string, e.g.:
 *   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
 *   Set the same value in both AIDTRACE_CENTER_WEBHOOK_SECRET and
 *   AIDTRACE_CENTER_WEBHOOK_SECRET on the receiver (same app = same Vercel project).
 */

import Zavudev from "@zavudev/sdk";

const SECRET        = process.env.AIDTRACE_CENTER_WEBHOOK_SECRET || "";
const NOTIFY_CHAT   = process.env.AIDTRACE_CENTER_NOTIFY_CHAT    || "";
const CELOSCAN_TX   = process.env.CELOSCAN_TX_BASE               || "https://celoscan.io/tx";
const SUPABASE_URL  = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const zavu = new Zavudev({ apiKey: process.env.RASTROAYUDA_ZAVU_API_KEY });

function isAuthorized(req) {
  if (!SECRET) return true;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return bearer === SECRET;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const body = req.body || {};
  if (body.event !== "center.delivery") {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const { centerCode, batchId, actionType, details, txHash } = body;
  console.info("[center-webhook] received:", centerCode, batchId, actionType);

  // Record the delivery in Supabase so center-inventory reflects it.
  // Uses upsert (ON CONFLICT DO UPDATE) so double-calls from zavu.mjs are no-ops.
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_center_delivery`, {
        method: "POST",
        headers: {
          apikey:          SUPABASE_KEY,
          Authorization:   `Bearer ${SUPABASE_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          p_center_code:  centerCode,
          p_batch_id:     batchId,
          p_action_type:  actionType  || "DELIVERED",
          p_details:      details     || "",
          p_tx_hash:      txHash      || null,
        }),
      });
      if (!r.ok) {
        console.warn("[center-webhook] Supabase record failed:", r.status, await r.text().catch(() => ""));
      }
    } catch (err) {
      console.warn("[center-webhook] Supabase record error:", err.message);
    }
  }

  if (NOTIFY_CHAT) {
    try {
      const txLine = txHash ? `\nTx: ${CELOSCAN_TX}/${txHash}` : "";
      await zavu.messages.send({
        to:              NOTIFY_CHAT,
        channel:         "telegram",
        text: [
          `📦 Entrega registrada — ${centerCode}`,
          `Lote: ${batchId}`,
          `Accion: ${actionType}`,
          `Detalles: ${details || "—"}`,
        ].join("\n") + txLine,
        idempotencyKey: `center-notify-${centerCode}-${batchId}-${actionType}`,
      });
      console.info("[center-webhook] Telegram notified:", NOTIFY_CHAT);
    } catch (err) {
      console.warn("[center-webhook] Telegram notification failed:", err.message);
    }
  }

  return res.status(200).json({ ok: true, centerCode, batchId });
}
