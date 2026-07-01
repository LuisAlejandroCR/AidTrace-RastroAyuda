/**
 * api/queue-status.mjs — AidTrace queue health endpoint
 *
 * GET /api/queue-status
 * Returns counts by status + last processed timestamp so coordinators
 * can see if the relay worker is healthy without accessing Supabase directly.
 *
 * Public read (counts only — no message content exposed).
 * Requires:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CACHE_SECONDS = 30;

async function countByStatus(status) {
  const url =
    `${SUPABASE_URL}/rest/v1/aidtrace_message_queue` +
    `?status=eq.${encodeURIComponent(status)}` +
    `&select=id`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
    },
  });

  if (!r.ok) throw new Error(`Supabase count error ${r.status}`);
  const countHeader = r.headers.get("content-range") || "";
  const match = countHeader.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function lastProcessedAt() {
  const url =
    `${SUPABASE_URL}/rest/v1/aidtrace_message_queue` +
    `?status=eq.completed` +
    `&order=updated_at.desc` +
    `&limit=1` +
    `&select=updated_at,channel,batch_id`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function recentFailed() {
  const url =
    `${SUPABASE_URL}/rest/v1/aidtrace_message_queue` +
    `?status=eq.failed` +
    `&order=updated_at.desc` +
    `&limit=5` +
    `&select=id,channel,batch_id,last_error,updated_at,attempts`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ ok: false, error: "Queue not configured" });
  }

  try {
    const [pending, processing, completed, failed, last, failedRows] = await Promise.all([
      countByStatus("pending"),
      countByStatus("processing"),
      countByStatus("completed"),
      countByStatus("failed"),
      lastProcessedAt(),
      recentFailed(),
    ]);

    const workerHealthy = pending === 0 || (last && Date.now() - new Date(last.updated_at).getTime() < 15 * 60 * 1000);

    res.setHeader("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
    return res.status(200).json({
      ok: true,
      counts: { pending, processing, completed, failed },
      lastProcessed: last
        ? { at: last.updated_at, channel: last.channel, batchId: last.batch_id }
        : null,
      workerHealthy,
      recentFailures: failedRows.map((r) => ({
        id: r.id,
        channel: r.channel,
        batchId: r.batch_id,
        attempts: r.attempts,
        lastError: r.last_error,
        failedAt: r.updated_at,
      })),
    });
  } catch (err) {
    console.error("[queue-status] error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
