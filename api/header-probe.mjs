export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AidTrace-Webhook-Token");
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const aidTraceHeader = String(req.headers["x-aidtrace-webhook-token"] || "");
  const authorization = String(req.headers.authorization || "");
  const hasAidTraceHeader = aidTraceHeader.length > 0;
  const hasBearer = /^Bearer\s+\S+/i.test(authorization);

  console.info("AidTrace header probe", {
    method: req.method,
    hasAidTraceHeader,
    aidTraceHeaderLength: aidTraceHeader.length,
    hasBearer,
    userAgent: req.headers["user-agent"] || "",
  });

  res.status(200).json({
    ok: true,
    method: req.method,
    hasAidTraceHeader,
    aidTraceHeaderLength: aidTraceHeader.length,
    hasBearer,
    next:
      hasAidTraceHeader || hasBearer
        ? "Header arrived. You can enable AIDTRACE_WEBHOOK_TOKEN after configuring the same value in Zavu."
        : "Header missing. Do not enable AIDTRACE_WEBHOOK_TOKEN yet.",
  });
}
