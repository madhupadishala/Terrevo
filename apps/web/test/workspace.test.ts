import assert from "node:assert/strict";
import test from "node:test";
import { ApiFailure, TerrevoWebApi } from "../src/terrevo-api.ts";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SESSION = { accessToken: "only-test-token", refreshToken: "only-test-refresh", expiresIn: 3600, user: { id: "u", email: null } };

test("business APIs reject unauthenticated calls instead of fabricating a local workflow", async () => {
  const api = new TerrevoWebApi();
  await assert.rejects(api.progress(), error => error instanceof ApiFailure && error.status === 401);
  assert.equal(api.connected, false);
});

test("web requests use /api/v1 routes, authorized token and tenant boundary", async () => {
  const previous = globalThis.fetch;
  const seen: Array<{ path: string; method: string; tenant: string | null; bearer: string | null }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const path = String(input);
    seen.push({ path, method: init?.method ?? "GET", tenant: headers.get("x-tenant-id"), bearer: headers.get("authorization") });
    if (path === "/api/v1/auth/login") return Response.json(SESSION);
    if (path === "/api/v1/tenants") return Response.json({ tenants: [{ id: TENANT, name: "Test organization", slug: "test", status: "active" }] });
    if (path === "/api/v1/access-context") return Response.json({ context: { roles: [{roleKey:"MR",scopeOrgUnitId:TENANT}], permissions: [], orgAssignments: [] } });
    if (path === "/api/v1/tour-executions/start-options") return Response.json({ options: [] });
    if (path === "/api/v1/tour-executions/start") return Response.json({ execution: { id: "test" } }, { status: 201 });
    return Response.json({error: "Unexpected request"}, {status:404});
  }) as typeof fetch;
  try {
    const api = new TerrevoWebApi();
    await api.login("test@example.invalid", "dummy-test-password");
    const orgs = await api.tenants();
    assert.equal(orgs.length, 1);
    await assert.rejects(api.startOptions(), error => error instanceof ApiFailure && error.status === 400);
    api.setTenant(TENANT);
    assert.equal((await api.access()).roles[0].roleKey, "MR");
    assert.deepEqual(await api.startOptions(), []);
    await api.startTour("22222222-2222-4222-8222-222222222222", {latitude:17.385,longitude:78.4867,accuracyMeters:15});
    assert.deepEqual(seen.map(x => x.path), [
      "/api/v1/auth/login", "/api/v1/tenants", "/api/v1/access-context",
      "/api/v1/tour-executions/start-options", "/api/v1/tour-executions/start",
    ]);
    assert.equal(seen[4].bearer, "Bearer only-test-token");
    assert.equal(seen[4].tenant, TENANT);
    assert.equal(seen[1].tenant, null);
  } finally { globalThis.fetch = previous; }
});

test("tenant switching requires explicit context and never supplies a global privileged key", async () => {
  const api = new TerrevoWebApi();
  api.setSession(SESSION);
  api.setTenant(TENANT);
  assert.equal(api.connected, true);
  api.reset();
  assert.equal(api.connected, false);
  await assert.rejects(api.orgUnits(), error => error instanceof ApiFailure && error.status === 401);
});
