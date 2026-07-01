/**
 * api/export.mjs — AidTrace center delivery CSV export
 *
 * GET /api/export?center=CENTRO-NORTE-1[&format=csv][&limit=500]
 *
 * Returns all delivery rows for the given center as CSV (default)
 * or JSON (?format=json). Aid organizations need paper records;
 * data is already public on Celoscan.
 *
 * No auth required — data is already public.
 * Requires:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CELOSCAN_TX  = process.env.CELOSCAN_TX_BASE || "https://celoscan.io/tx";

function escapeCSV(value) {
  const str = String(value == null ? "" : value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(row) {
  return [
    row.center_code,
    row.batch_id,
    row.action_type,
    row.details || "",
    row.tx_hash || "",
    row.tx_hash ? `${CELOSCAN_TX}/${row.tx_hash}` : "",
    row.recorded_at,
  ]
    .map(escapeCSV)
    .join(",");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const center = req.query.center ? String(req.query.center).toUpperCase().trim() : null;
  if (!center) return res.status(400).json({ ok: false, error: "Missing ?center= parameter" });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ ok: false, error: "Export not configured" });
  }

  const format = String(req.query.format || "csv").toLowerCase();
  const limit  = Math.min(Math.max(1, Number(req.query.limit || 500)), 2000);

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/aidtrace_center_inventory` +
      `?center_code=eq.${encodeURIComponent(center)}` +
      `&order=recorded_at.asc` +
      `&limit=${limit}` +
      `&select=center_code,batch_id,action_type,details,tx_hash,recorded_at`;

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      console.error("[export] Supabase error:", r.status, await r.text().catch(() => ""));
      return res.status(502).json({ ok: false, error: "Upstream error" });
    }

    const rows = await r.json();
    const data = Array.isArray(rows) ? rows : [];

    if (format === "json") {
      return res.status(200).json({
        ok: true,
        centerCode: center,
        count: data.length,
        deliveries: data.map((row) => ({
          batchId:     row.batch_id,
          actionType:  row.action_type,
          details:     row.details || "",
          txHash:      row.tx_hash || null,
          celoscanUrl: row.tx_hash ? `${CELOSCAN_TX}/${row.tx_hash}` : null,
          recordedAt:  row.recorded_at,
        })),
      });
    }

    // CSV
    const filename = `aidtrace-${center}-${new Date().toISOString().slice(0, 10)}.csv`;
    const header = "center_code,batch_id,action_type,details,tx_hash,celoscan_url,recorded_at";
    const csvRows = data.map(rowToCSV);
    const csv = [header, ...csvRows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[export] error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
