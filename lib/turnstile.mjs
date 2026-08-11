const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken({ secret, token, remoteIp }) {
  if (!secret) {
    return { ok: false, error: "missing_secret" };
  }

  if (!token || typeof token !== "string" || token.length > 2048) {
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
    });

    if (!response.ok) {
      return { ok: false, error: `upstream_${response.status}` };
    }

    payload = await response.json();
  } catch (error) {
    return { ok: false, error: "network_error" };
  }

  if (payload?.success === true) {
    return { ok: true, error: null };
  }

  const codes = Array.isArray(payload?.["error-codes"]) ? payload["error-codes"] : [];
  return { ok: false, error: codes.join(",") || "invalid_response" };
}