/**
 * api/retry-queue.mjs — reset a failed queue row back to pending
 *
 * POST /api/retry-queue
 * Body: { id: "<uuid>" }
 * Auth: Authorization: Bearer <AIDTRACE_QUEUE_WORKER_TOKEN>
 *       or X-AidTrace-Worker-Token: <token>
 *
 * Requires supabase/aidtrace_queue_retry.sql to be run first.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WORKER_TOKEN = process.env.AIDTRACE_QUEUE_WORKER_TOKEN || "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAuthorized(req) {
  if (!WORKER_TOKEN) return false;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const header = String(req.headers["x-aidtrace-worker-token"] || "");
  return bearer === WORKER_TOKEN || header === WORKER_TOKEN;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, X-AidTrace-Worker-Token, Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!isAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const id = String((req.body || {}).id || "").trim();
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing id (must be a UUID)" });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ ok: false, error: "Queue not configured" });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/retry_aidtrace_message`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_id: id }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("[retry-queue] Supabase error:", r.status, text);
      return res.status(502).json({ ok: false, error: "Upstream error" });
    }

    const data = await r.json();
    if (!data.ok) {
      return res.status(404).json({ ok: false, error: "Row not found or not in failed state" });
    }

    console.info("[retry-queue] reset to pending:", id);
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error("[retry-queue] error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
