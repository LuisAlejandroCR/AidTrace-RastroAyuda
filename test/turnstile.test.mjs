import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstileToken } from "../lib/turnstile.mjs";

function mockFetch(payload, status = 200) {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.match(url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
    assert.match(String(options?.body || ""), /secret=abc123/);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    };
  };
  return () => {
    global.fetch = originalFetch;
  };
}

test("returns missing_token when no token is provided", async () => {
  const result = await verifyTurnstileToken({ secret: "abc123", token: "" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "missing_token");
});

test("returns missing_secret when secret is not configured", async () => {
  const result = await verifyTurnstileToken({ secret: "", token: "token" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "missing_secret");
});

test("passes when Cloudflare confirms the token", async () => {
  const restore = mockFetch({ success: true });
  try {
    const result = await verifyTurnstileToken({
      secret: "abc123",
      token: "valid-token",
      remoteIp: "1.2.3.4",
    });
    assert.equal(result.ok, true);
  } finally {
    restore();
  }
});

test("fails with error codes when Cloudflare rejects the token", async () => {
  const restore = mockFetch({ success: false, "error-codes": ["invalid-input-response"] });
  try {
    const result = await verifyTurnstileToken({ secret: "abc123", token: "bad-token" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid-input-response");
  } finally {
    restore();
  }
});

test("maps upstream failures to upstream_<status>", async () => {
  const restore = mockFetch({}, 503);
  try {
    const result = await verifyTurnstileToken({ secret: "abc123", token: "token" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "upstream_503");
  } finally {
    restore();
  }
});