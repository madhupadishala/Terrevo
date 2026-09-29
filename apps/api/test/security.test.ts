import test from "node:test";
import assert from "node:assert/strict";
import {
  hardenApiResponse,
  readBoundedJsonObject,
  RequestBodyError,
  resolveRequestId,
} from "../../../modules/security/src/index.ts";

test("TRV-SEC-001 hardening adds correlation and anti-browser-execution headers", async () => {
  const response = hardenApiResponse(Response.json({ ok: true }), "req-123");
  assert.equal(response.headers.get("x-request-id"), "req-123");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  assert.deepEqual(await response.json(), { ok: true });
});

test("TRV-SEC-001 unsafe request IDs are replaced rather than reflected", () => {
  assert.equal(resolveRequestId("valid_ID-1.2"), "valid_ID-1.2");
  const generated = resolveRequestId("bad value\r\nheader: injected");
  assert.notEqual(generated, "bad value\r\nheader: injected");
  assert.match(generated, /^[0-9a-f-]{36}$/i);
});

test("TRV-SEC-002 body byte limit is enforced without Content-Length", async () => {
  const request = new Request("https://terrevo.example/v1/test", {
    method: "POST",
    body: JSON.stringify({ value: "0123456789" }),
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(
    () => readBoundedJsonObject(request, 8),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413,
  );
});

test("TRV-SEC-002 parser accepts only bounded JSON objects", async () => {
  const ok = await readBoundedJsonObject(new Request("https://terrevo.example/v1/test", {
    method: "POST",
    body: JSON.stringify({ a: 1 }),
  }), 128);
  assert.deepEqual(ok, { a: 1 });

  await assert.rejects(
    () => readBoundedJsonObject(new Request("https://terrevo.example/v1/test", {
      method: "POST",
      body: "[]",
    }), 128),
    (error: unknown) => error instanceof RequestBodyError && error.status === 400,
  );
});
