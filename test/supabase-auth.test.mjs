import assert from "node:assert/strict";
import test from "node:test";
import { verifyAccessToken } from "../lib/supabase-auth.mjs";

function mockFetch(status, payload) {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.match(url, /\/auth\/v1\/user$/);
    assert.equal(options.headers.Authorization, "Bearer valid-token");
    assert.equal(options.headers.apikey, "anon-key");
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
  return () => {
    global.fetch = originalFetch;
  };
}

test("returns null on missing token", async () => {
  const result = await verifyAccessToken({ token: "", supabaseUrl: "https://x.supabase.co", anonKey: "k" });
  assert.equal(result, null);
});

test("returns null when supabase is not configured", async () => {
  const result = await verifyAccessToken({ token: "t", supabaseUrl: "", anonKey: "" });
  assert.equal(result, null);
});

test("returns user when the token is valid", async () => {
  const restore = mockFetch(200, { id: "user-123", email: "op@example.com" });
  try {
    const result = await verifyAccessToken({ token: "valid-token", supabaseUrl: "https://x.supabase.co", anonKey: "anon-key" });
    assert.deepEqual(result, { userId: "user-123", email: "op@example.com" });
  } finally {
    restore();
  }
});

test("returns null when Supabase rejects the token", async () => {
  const restore = mockFetch(401, { message: "Invalid JWT" });
  try {
    const result = await verifyAccessToken({ token: "valid-token", supabaseUrl: "https://x.supabase.co", anonKey: "anon-key" });
    assert.equal(result, null);
  } finally {
    restore();
  }
});