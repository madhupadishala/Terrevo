import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/handler.ts";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "public-test-key",
};

function sequenceFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected fetch call");
    return Response.json(next.body ?? {}, { status: next.status ?? 200 });
  };
  return { fetcher, calls };
}

test("TRV-ID-001 rejects malformed login input before provider call", async () => {
  const { fetcher, calls } = sequenceFetch([]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "x" }),
  }));

  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test("TRV-ID-001 authenticates through the provider without storing passwords", async () => {
  const { fetcher, calls } = sequenceFetch([{
    body: {
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      user: { id: "user-1", email: "mr@example.com" },
    },
  }]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "MR@Example.com ", password: "secret" }),
  }));
  const body = await response.json() as { user: { id: string } };

  assert.equal(response.status, 200);
  assert.equal(body.user.id, "user-1");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/v1\/token\?grant_type=password$/);
  assert.match(String(calls[0].init?.body), /"email":"mr@example.com"/);
});

test("TRV-ID-001 maps provider credential rejection to 401", async () => {
  const { fetcher } = sequenceFetch([{ status: 400, body: { message: "Invalid login credentials" } }]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "mr@example.com", password: "wrong" }),
  }));

  assert.equal(response.status, 401);
});

test("TRV-ID-005 refreshes a session through the provider", async () => {
  const { fetcher, calls } = sequenceFetch([{
    body: {
      access_token: "access-2",
      refresh_token: "refresh-2",
      expires_in: 3600,
      user: { id: "user-1", email: "mr@example.com" },
    },
  }]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: "refresh-1" }),
  }));
  const body = await response.json() as { accessToken: string; refreshToken: string };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.accessToken, "access-2");
  assert.equal(body.refreshToken, "refresh-2");
  assert.match(calls[0].url, /grant_type=refresh_token$/);
});

test("TRV-ID-002 rejects protected routes without bearer token", async () => {
  const { fetcher, calls } = sequenceFetch([]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/me"));

  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("TRV-TENANT-001 lists only memberships returned under the authenticated token", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: { id: "user-1", email: "mr@example.com" } },
    { body: [{ tenant: { id: "11111111-1111-4111-8111-111111111111", name: "Demo Pharma", slug: "demo-pharma", status: "active" } }] },
  ]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/tenants", {
    headers: { authorization: "Bearer access" },
  }));
  const body = await response.json() as { tenants: Array<{ id: string }> };

  assert.equal(response.status, 200);
  assert.deepEqual(body.tenants.map((tenant) => tenant.id), ["11111111-1111-4111-8111-111111111111"]);
  assert.equal(calls.length, 2);
  assert.equal((calls[1].init?.headers as Record<string, string>).authorization, "Bearer access");
  assert.match(calls[1].url, /tenant\.status=eq\.active/);
});

test("TRV-TENANT-002 rejects malformed tenant IDs before tenant lookup", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: { id: "user-1", email: "mr@example.com" } },
  ]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/tenant-context", {
    headers: {
      authorization: "Bearer access",
      "x-tenant-id": "not-a-uuid",
    },
  }));

  assert.equal(response.status, 400);
  assert.equal(calls.length, 1);
});

test("TRV-TENANT-002 denies tenant context when active membership does not exist", async () => {
  const { fetcher } = sequenceFetch([
    { body: { id: "user-1", email: "mr@example.com" } },
    { body: [] },
  ]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/tenant-context", {
    headers: {
      authorization: "Bearer access",
      "x-tenant-id": "22222222-2222-4222-8222-222222222222",
    },
  }));

  assert.equal(response.status, 403);
});

test("TRV-TENANT-002 resolves tenant context only after membership verification", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: { id: "user-1", email: "mr@example.com" } },
    { body: [{ id: "11111111-1111-4111-8111-111111111111" }] },
  ]);
  const handle = createHandler(env, { fetcher });

  const response = await handle(new Request("https://api.terrevo.test/v1/tenant-context", {
    headers: {
      authorization: "Bearer access",
      "x-tenant-id": "11111111-1111-4111-8111-111111111111",
    },
  }));
  const body = await response.json() as { context: { userId: string; tenantId: string } };

  assert.equal(response.status, 200);
  assert.deepEqual(body.context, { userId: "user-1", tenantId: "11111111-1111-4111-8111-111111111111" });
  assert.match(calls[1].url, /\/rest\/v1\/tenants\?/);
  assert.match(calls[1].url, /status=eq\.active/);
});
