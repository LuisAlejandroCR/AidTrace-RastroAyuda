/**
 * scripts/relayer-alert.mjs — relayer balance watchdog
 *
 * Fetches GET /api/relayer-status (public) and sends a Telegram alert
 * via Zavu when the estimated proofs left drops below the threshold.
 *
 * Env (optional — exits 0 without alerting when notify config is missing):
 *   AIDTRACE_APP_URL             deployment URL
 *   AIDTRACE_ALERT_THRESHOLD     proofs-left threshold (default 50)
 *   RASTROAYUDA_ZAVU_API_KEY     Zavu API key (GitHub secret)
 *   AIDTRACE_CENTER_NOTIFY_CHAT  coordinator Telegram chat ID (GitHub secret)
 */

const APP_URL = (process.env.AIDTRACE_APP_URL || "https://aidtrace-rastroayuda.vercel.app").replace(/\/$/, "");
const THRESHOLD = Number(process.env.AIDTRACE_ALERT_THRESHOLD || "50");
const NOTIFY_CHAT = process.env.AIDTRACE_CENTER_NOTIFY_CHAT || "";
const ZAVU_API_KEY = process.env.RASTROAYUDA_ZAVU_API_KEY || "";
const RELAYER = "0x3dbb8633cbB45db718B8D72F14AE36E151695181";

const response = await fetch(`${APP_URL}/api/relayer-status`, {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(30000),
});

if (!response.ok) {
  console.error("relayer-alert: status endpoint failed:", response.status);
  process.exit(1);
}

const status = await response.json();
if (!status?.ok) {
  console.error("relayer-alert: status unavailable");
  process.exit(1);
}

const proofsLeft = Number(status.estProofsLeft || 0);
console.log(
  `relayer-alert: balance=${Number(status.balanceCelo || 0).toFixed(6)} CELO ` +
    `proofsLeft=${proofsLeft} gas=${Number(status.gasPriceGwei || 0).toFixed(1)} Gwei`,
);

if (proofsLeft > THRESHOLD) process.exit(0);

if (!NOTIFY_CHAT || !ZAVU_API_KEY) {
  console.warn("relayer-alert: below threshold but no notify config; skipping alert");
  process.exit(0);
}

const { default: Zavudev } = await import("@zavudev/sdk");
const zavu = new Zavudev({ apiKey: ZAVU_API_KEY });

await zavu.messages.send({
  to: NOTIFY_CHAT,
  channel: "telegram",
  text:
    `⚠️ AidTrace relayer balance low: ${Number(status.balanceCelo || 0).toFixed(4)} CELO ` +
    `(≈ ${proofsLeft} proofs left).\n` +
    `Fund on Celo: ${RELAYER}\n` +
    `https://celoscan.io/address/${RELAYER}`,
  idempotencyKey: `aidtrace-relayer-alert-${new Date().toISOString().slice(0, 13)}`,
});

console.log("relayer-alert: Telegram alert sent");