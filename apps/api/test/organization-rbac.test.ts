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

const authUser = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "admin@example.com" };
const tenantId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const divisionId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

function headers() {
  return {
    authorization: "Bearer user-token",
    "x-tenant-id": tenantId,
    "content-type": "application/json",
  };
}

test("TRV-ORG-001 lists organization units with the user token", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
    { body: [{ id: companyId, tenant_id: tenantId, parent_id: null, type: "company", code: "ACME", name: "Acme", status: "active" }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/org-units", { headers: headers() }),
  );
  const body = await response.json() as { units: Array<{ id: string }> };

  assert.equal(response.status, 200);
  assert.deepEqual(body.units.map((unit) => unit.id), [companyId]);
  assert.equal((calls[2].init?.headers as Record<string, string>).authorization, "Bearer user-token");
});

test("TRV-RBAC-002 blocks privileged write when permission is absent", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
    { body: false },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/org-units", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ type: "company", code: "ACME", name: "Acme" }),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(calls.length, 3);
  assert.equal(
    calls.some((call) => (call.init?.headers as Record<string, string> | undefined)?.authorization === "Bearer server-only-test-key"),
    false,
  );
});

test("TRV-ORG-001 rejects invalid hierarchy before insert", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
    { body: true },
    { body: [{ id: divisionId, tenant_id: tenantId, parent_id: companyId, type: "division", code: "DIV", name: "Division", status: "active" }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/org-units", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ type: "territory", parentId: divisionId, code: "T01", name: "Territory 1" }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(calls.length, 4);
});

test("TRV-ORG-001 writes with server credential only after authorization", async () => {
  const regionId = "55555555-5555-4555-8555-555555555555";
  const { fetcher, calls } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
    { body: true },
    { body: [{ id: regionId, tenant_id: tenantId, parent_id: divisionId, type: "region", code: "R1", name: "Region 1", status: "active" }] },
    { body: [{ id: "66666666-6666-4666-8666-666666666666", tenant_id: tenantId, parent_id: regionId, type: "area", code: "A1", name: "Area 1", status: "active" }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/org-units", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ type: "area", parentId: regionId, code: "A1", name: "Area 1" }),
    }),
  );

  assert.equal(response.status, 201);
  assert.equal((calls[4].init?.headers as Record<string, string>).authorization, "Bearer server-only-test-key");
});

test("TRV-RBAC-003 rejects MR without organization scope", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/role-assignments", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ userId, roleKey: "MR" }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(calls.length, 2);
});

test("TRV-RBAC-002 denies role assignment without RBAC_MANAGE", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
    { body: false },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/role-assignments", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ userId, roleKey: "MR", scopeOrgUnitId: companyId }),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(calls.length, 3);
});

test("TRV-RBAC-001 returns own access context", async () => {
  const { fetcher } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
    { body: [{ role_key: "MANAGER", scope_org_unit_id: companyId }] },
    { body: [{ org_unit_id: companyId, is_primary: true }] },
    { body: [
      { role_key: "MANAGER", permission_key: "ORG_VIEW" },
      { role_key: "MANAGER", permission_key: "TOUR_APPROVE" },
    ] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/access-context", { headers: headers() }),
  );
  const body = await response.json() as { context: { permissions: string[] } };

  assert.equal(response.status, 200);
  assert.deepEqual(body.context.permissions.sort(), ["ORG_VIEW", "TOUR_APPROVE"]);
});

test("TRV-ORG-003 uses atomic assignment RPC after ORG_MANAGE", async () => {
  const { fetcher, calls } = sequenceFetch([
    { body: authUser },
    { body: [{ id: tenantId }] },
    { body: true },
    { body: {} },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/org-assignments", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ userId, orgUnitId: companyId, isPrimary: true }),
    }),
  );

  assert.equal(response.status, 204);
  assert.match(calls[3].url, /\/rest\/v1\/rpc\/admin_assign_user_org$/);
  assert.equal((calls[3].init?.headers as Record<string, string>).authorization, "Bearer server-only-test-key");
});
