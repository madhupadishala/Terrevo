import test from "node:test";
import assert from "node:assert/strict";
import { createVercelApiHandler } from "../src/vercel-runtime.ts";

test("request logs correlate responses without credentials, identifiers or location", async () => {
  const logs: unknown[] = [];
  const response = await createVercelApiHandler({}, entry=>logs.push(entry)).fetch(new Request(
    "https://terrevo.example/api/v1/visits/00000000-0000-4000-8000-000000000001?access_token=secret-query",
    {method:"POST",headers:{authorization:"Bearer secret-token","x-request-id":"qualification-request"},body:JSON.stringify({password:"secret-password",latitude:17.385})},
  ));
  assert.equal(response.status,503);
  const serialized=JSON.stringify(logs);
  for(const sensitive of ["secret-query","secret-token","secret-password","17.385","00000000-0000"])assert.equal(serialized.includes(sensitive),false);
  const entry=logs[0] as {requestId:string;route:string;elapsedMs:number;status:number};
  assert.equal(entry.requestId,response.headers.get("x-request-id"));
  assert.match(response.headers.get("server-timing")??"",/^app;dur=\d+$/);
  assert.equal(entry.route,"/v1/visits");assert.equal(entry.status,503);assert.ok(entry.elapsedMs>=0);
  const unknown:unknown[]=[];
  await createVercelApiHandler({},entry=>unknown.push(entry)).fetch(new Request("https://terrevo.example/api/v1/private-credential"));
  assert.equal((unknown[0] as {route:string}).route,"unknown");
});

test("logging failures preserve API response and cannot trigger business retries", async () => {
  const response=await createVercelApiHandler({},()=>{throw new Error("logger unavailable");}).fetch(new Request("https://terrevo.example/api/health"));
  assert.equal(response.status,200);assert.ok(response.headers.get("x-request-id"));
});

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
    SUPABASE_PUBLISHABLE_KEY: "publishable-secret-value",
    SUPABASE_SECRET_KEY: "service-secret-value",
  }).fetch(new Request("https://terrevo.example/api/health"));
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(body.includes("secret-value"), false);
  assert.equal(JSON.parse(body).status, "ok");
});

test("TRV-DEPLOY-005 legacy Supabase key names remain temporary fallback", async () => {
  const response = await createVercelApiHandler({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "legacy-anon",
    SUPABASE_SERVICE_ROLE_KEY: "legacy-service",
  }).fetch(new Request("https://terrevo.example/api/health"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});
