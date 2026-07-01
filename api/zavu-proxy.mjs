/**
 * api/zavu-proxy.mjs  — Zavu webhook proxy
 *
 * Zavu cannot attach custom request headers to outbound webhooks.
 * This proxy sits between Zavu and /api/zavu:
 *
 *   Zavu → POST /api/zavu-proxy
 *         (verifies Svix HMAC signature with RASTROAYUDA_WEBHOOK_SECRET)
 *         → POST /api/zavu  +  X-AidTrace-Webhook-Token header
 *
 * This lets AIDTRACE_WEBHOOK_TOKEN be enforced on /api/zavu while Zavu
 * only needs to know the proxy URL (no custom header support required).
 *
 * Vercel env vars required:
 *   RASTROAYUDA_WEBHOOK_SECRET   — Zavu signing secret (whsec_...)
 *   AIDTRACE_WEBHOOK_TOKEN       — token forwarded to /api/zavu
 *   AIDTRACE_APP_URL             — deployment URL (e.g. https://aidtrace-rastroayuda.vercel.app)
 *
 * Update the Zavu webhook URL to:
 *   https://aidtrace-rastroayuda.vercel.app/api/zavu-proxy
 */

import { createHmac } from "node:crypto";

const WEBHOOK_SECRET = process.env.RASTROAYUDA_WEBHOOK_SECRET || "";
const WEBHOOK_TOKEN  = process.env.AIDTRACE_WEBHOOK_TOKEN || "";
const APP_URL        = (process.env.AIDTRACE_APP_URL || "").replace(/\/$/, "");

function verifyZavuSignature(req) {
  if (!WEBHOOK_SECRET) return true;

  const msgId        = String(req.headers["svix-id"]        || "");
  const msgTimestamp = String(req.headers["svix-timestamp"] || "");
  const msgSignature = String(req.headers["svix-signature"] || "");

  if (!msgId || !msgTimestamp || !msgSignature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(msgTimestamp)) > 300) return false;

  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
  const rawBody     = JSON.stringify(req.body);
  const toSign      = `${msgId}.${msgTimestamp}.${rawBody}`;
  const computed    = createHmac("sha256", secretBytes).update(toSign).digest("base64");

  return msgSignature.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    return version === "v1" && sig === computed;
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  if (!verifyZavuSignature(req)) {
    return res.status(401).json({ ok: false, error: "Invalid webhook signature" });
  }

  const host   = APP_URL || `https://${req.headers.host}`;
  const target = `${host}/api/zavu`;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WEBHOOK_TOKEN && { "X-AidTrace-Webhook-Token": WEBHOOK_TOKEN }),
      },
      body: JSON.stringify(req.body),
    });
  } catch (err) {
    console.error("[zavu-proxy] upstream fetch failed:", err.message);
    return res.status(502).json({ ok: false, error: "Upstream error" });
  }

  const text        = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";
  return res.status(upstream.status).setHeader("Content-Type", contentType).send(text);
}
