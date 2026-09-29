import test from "node:test";
import assert from "node:assert/strict";
import { createVercelApiHandler } from "../src/vercel-runtime.ts";

test("TRV-DEPLOY-001 health is reachable without provider secrets", async () => {
  const response = await createVercelApiHandler({}).fetch(
    new Request("https://terrevo.example/api/health"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "degraded",
    web: "ready",
    apiAdapter: "ready",
    provider: {
      identity: "missing",
      serverMutations: "missing",
    },
  });
});

test("TRV-DEPLOY-004 Vercel gateway rewrite restores the health path", async () => {
  const response = await createVercelApiHandler({}).fetch(
    new Request("https://terrevo.example/api?__terrevo_path=health"),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).apiAdapter, "ready");
});

test("TRV-DEPLOY-004 nested business route reaches Terrevo and fails closed without provider config", async () => {
  const response = await createVercelApiHandler({}).fetch(
    new Request("https://terrevo.example/api?__terrevo_path=v1/tenants"),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "API provider configuration is missing",
  });
});

test("TRV-DEPLOY-001 health does not expose provider secret values", async () => {
  const response = await createVercelApiHandler({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-secret-value",
    SUPABASE_SERVICE_ROLE_KEY: "service-secret-value",
  }).fetch(new Request("https://terrevo.example/api/health"));
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(body.includes("secret-value"), false);
  assert.equal(JSON.parse(body).status, "ok");
});
