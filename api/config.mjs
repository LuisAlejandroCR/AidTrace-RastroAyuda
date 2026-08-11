const DEFAULT_ALLOWED_ORIGINS = [
  "https://aidtrace-rastroayuda.vercel.app",
  "http://127.0.0.1:8017",
  "http://localhost:8017",
];
const ALLOWED_ORIGINS = new Set(
  (process.env.AIDTRACE_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const config = {
    app: "AidTrace",
  };

  const siteKey = process.env.AIDTRACE_TURNSTILE_SITE_KEY || "";
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || "";

  if (siteKey) config.turnstileSiteKey = siteKey;
  if (supabaseUrl && anonKey) {
    config.supabaseUrl = supabaseUrl;
    config.supabaseAnonKey = anonKey;
    config.authRequired = process.env.AIDTRACE_REQUIRE_AUTH === "true";
  }

  return res.status(200).json(config);
}
