import assert from "node:assert/strict";
import test from "node:test";

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    end(value) {
      this.body = value;
      return this;
    },
  };
}

test("rejects unsupported empty zavu webhook posts", async () => {
  process.env.RASTROAYUDA_ZAVU_API_KEY = "zv_test_unit_1234567890";
  const { default: handler } = await import("../api/zavu.mjs");
  const req = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: {},
    url: "/api/zavu",
    socket: {
      remoteAddress: "127.0.0.1",
    },
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { ok: false, error: "Unsupported event" });
});

test("rejects browser relay packets from an unknown origin", async () => {
  process.env.RASTROAYUDA_ZAVU_API_KEY = "zv_test_unit_1234567890";
  const { default: handler } = await import("../api/zavu.mjs");
  const req = {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    body: {
      schema: "aidtrace.relay.v1",
      pending: [],
    },
    url: "/api/zavu",
    socket: {
      remoteAddress: "127.0.0.1",
    },
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { ok: false, error: "Origin not allowed" });
});
