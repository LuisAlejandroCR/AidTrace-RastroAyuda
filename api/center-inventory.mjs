/**
 * api/center-inventory.mjs — read center delivery history
 *
 * GET /api/center-inventory?center=CENTRO-NORTE-1[&limit=50]
 *
 * Returns all AidTrace delivery events linked to a center code.
 * Requires supabase/center_inventory.sql to be executed first.
 *
 * No auth required — all data is already public on Celoscan.
 * Env vars required:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CELOSCAN_TX = process.env.CELOSCAN_TX_BASE || "https://celoscan.io/tx";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const center = req.query.center ? String(req.query.center).toUpperCase().trim() : null;
  if (!center) return res.status(400).json({ ok: false, error: "Missing ?center= parameter" });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ ok: false, error: "Center inventory not configured" });
  }

  try {
    const limit = Math.min(Math.max(1, Number(req.query.limit || 50)), 200);
    const url =
      `${SUPABASE_URL}/rest/v1/aidtrace_center_inventory` +
      `?center_code=eq.${encodeURIComponent(center)}` +
      `&order=recorded_at.desc` +
      `&limit=${limit}` +
      `&select=batch_id,action_type,details,tx_hash,recorded_at`;

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      console.error("[center-inventory] Supabase error:", r.status, await r.text().catch(() => ""));
      return res.status(502).json({ ok: false, error: "Upstream error" });
    }

    const rows = await r.json();
    const deliveries = (Array.isArray(rows) ? rows : []).map((row) => ({
      batchId:    row.batch_id,
      actionType: row.action_type,
      details:    row.details || "",
      txHash:     row.tx_hash || null,
      celoscanUrl: row.tx_hash ? `${CELOSCAN_TX}/${row.tx_hash}` : null,
      recordedAt: row.recorded_at,
    }));

    return res.status(200).json({
      ok: true,
      centerCode: center,
      deliveries,
      count: deliveries.length,
    });
  } catch (err) {
    console.error("[center-inventory] error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
