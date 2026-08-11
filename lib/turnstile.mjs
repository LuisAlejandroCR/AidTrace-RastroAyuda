const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_ACTION = process.env.AIDTRACE_TURNSTILE_ACTION || "relay";
const DEFAULT_HOSTNAMES = new Set(
  (process.env.AIDTRACE_TURNSTILE_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean),
);

export async function verifyTurnstileToken({
  secret,
  token,
  remoteIp,
  expectedAction = DEFAULT_ACTION,
  expectedHostnames = DEFAULT_HOSTNAMES,
}) {
  if (!secret) {
    return { ok: false, error: "missing_secret" };
  }

  if (!token || typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, error: "missing_token" };
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) {
    form.set("remoteip", String(remoteIp).slice(0, 64));
  }

  let payload;
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { ok: false, error: `upstream_${response.status}` };
    }

    payload = await response.json();
  } catch (error) {
    return { ok: false, error: "network_error" };
  }

  if (payload?.success === true) {
    if (expectedAction && payload.action !== expectedAction) {
      return { ok: false, error: "action_mismatch" };
    }
    if (expectedHostnames.size > 0) {
      const hostname = String(payload.hostname || "").toLowerCase();
      if (!expectedHostnames.has(hostname)) {
        return { ok: false, error: "hostname_mismatch" };
      }
    }
    return { ok: true, error: null };
  }

  const codes = Array.isArray(payload?.["error-codes"]) ? payload["error-codes"] : [];
  return { ok: false, error: codes.join(",") || "invalid_response" };
}