import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/handler.ts";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "public-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
};

function sequenceFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected fetch call: ${String(input)}`);
    return Response.json(next.body ?? {}, { status: next.status ?? 200 });
  };
  return { fetcher, calls };
}

const tenantId = "11111111-1111-4111-8111-111111111111";
const territoryId = "22222222-2222-4222-8222-222222222222";
const divisionId = "33333333-3333-4333-8333-333333333333";
const productId = "44444444-4444-4444-8444-444444444444";

function authResponses() {
  return [
    { body: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "manager@example.com" } },
    { body: [{ id: tenantId }] },
  ];
}

function headers() {
  return {
    authorization: "Bearer user-token",
    "x-tenant-id": tenantId,
    "content-type": "application/json",
  };
}

test("TRV-MST-006 lists doctors through user-scoped RLS", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: "d1", code: "DR1", name: "Dr One", status: "active", territory_id: territoryId }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/masters/doctors", { headers: headers() }),
  );

  assert.equal(response.status, 200);
  assert.equal((calls[2].init?.headers as Record<string, string>).authorization, "Bearer user-token");
  assert.match(calls[2].url, /\/rest\/v1\/doctors\?/);
});

test("TRV-MST-007 refuses doctor create before service-key write when permission is absent", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: territoryId, tenant_id: tenantId, parent_id: null, type: "territory", code: "T1", name: "T1", status: "active" }] },
    { body: false },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/masters/doctors", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        code: "DR1", name: "Dr One", specialty: "Cardiology", territoryId,
      }),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(calls.some((call) => (call.init?.headers as Record<string,string> | undefined)?.authorization === "Bearer server-only-test-key"), false);
});

test("TRV-MST-003 rejects doctor scope that is not a territory", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: territoryId, tenant_id: tenantId, parent_id: null, type: "area", code: "A1", name: "Area", status: "active" }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/masters/doctors", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        code: "DR1", name: "Dr One", specialty: "Cardiology", territoryId,
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(calls.length, 3);
});

test("TRV-MST-007 creates doctor with service key after MASTER_MANAGE", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: territoryId, tenant_id: tenantId, parent_id: null, type: "territory", code: "T1", name: "T1", status: "active" }] },
    { body: true },
    { body: [{ id: "d1", tenant_id: tenantId, code: "DR1", name: "Dr One", specialty: "Cardiology", territory_id: territoryId, status: "active" }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/masters/doctors", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        code: "DR1", name: "Dr One", specialty: "Cardiology", territoryId,
      }),
    }),
  );

  assert.equal(response.status, 201);
  assert.equal((calls[4].init?.headers as Record<string,string>).authorization, "Bearer server-only-test-key");
});

test("TRV-MST-004 rejects sample when product belongs to another division", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: divisionId, tenant_id: tenantId, parent_id: null, type: "division", code: "D1", name: "Division", status: "active" }] },
    { body: [{ id: productId, code: "P1", name: "Product", status: "active", division_id: "55555555-5555-4555-8555-555555555555" }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/masters/samples", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        code: "S1", name: "Sample", productId, divisionId,
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(calls.length, 4);
});

test("TRV-MST-001 rejects unknown master kind", async () => {
  const { fetcher, calls } = sequenceFetch([]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/masters/unknown", { headers: headers() }),
  );

  assert.equal(response.status, 404);
  assert.equal(calls.length, 0);
});
