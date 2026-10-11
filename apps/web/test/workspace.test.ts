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


test("concurrent API 401 responses share a single refresh-token rotation", async () => {
  const previous=globalThis.fetch;
  let rotations=0;
  const requests:string[]=[];
  globalThis.fetch=(async (input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input);
    const headers=new Headers(init?.headers);
    if(path==="/api/v1/auth/refresh"){
      rotations++;
      return Response.json({accessToken:"new-token",refreshToken:"new-refresh",expiresIn:3600,user:{id:"u",email:null}});
    }
    requests.push(headers.get("authorization")??"");
    if(headers.get("authorization")==="Bearer old-token")return Response.json({error:"expired"},{status:401});
    if(path==="/api/v1/tour-executions/start-options")return Response.json({options:[]});
    if(path==="/api/v1/tour-executions/progress")return Response.json({progress:null});
    return Response.json({error:"unexpected"},{status:404});
  }) as typeof fetch;
  try{
    const api=new TerrevoWebApi();
    api.setSession({accessToken:"old-token",refreshToken:"old-refresh",expiresIn:3600,user:{id:"u",email:null}});
    api.setTenant(TENANT);
    const result=await Promise.all([api.startOptions(),api.progress()]);
    assert.deepEqual(result,[[],null]);
    assert.equal(rotations,1,"only one refresh exchange may consume a refresh token");
    assert.ok(requests.includes("Bearer new-token"));
  }finally{globalThis.fetch=previous;}
});

test("invalid refresh responses do not restore a broken session",async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=(async (input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input)==="/api/v1/auth/refresh")return Response.json({accessToken:"new-token",refreshToken:null,expiresIn:3600,user:{id:"u"}});
    return Response.json({error:"expired"},{status:401});
  }) as typeof fetch;
  try{
    const api=new TerrevoWebApi();
    api.setSession({accessToken:"old",refreshToken:"expired",expiresIn:3600,user:{id:"u",email:null}});
    api.setTenant(TENANT);
    await assert.rejects(api.startOptions(),(error:unknown)=>error instanceof ApiFailure && error.status===401);
    assert.equal(api.connected,false);
  }finally{globalThis.fetch=old;}
});


test("successful token refresh followed by business 404 preserves the active session", async () => {
  const prior=globalThis.fetch;
  let calls=0;
  globalThis.fetch=(async (input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input),bearer=new Headers(init?.headers).get("authorization");
    if(path==="/api/v1/auth/refresh")return Response.json({accessToken:"rotated",refreshToken:"rotated-refresh",expiresIn:3600,user:{id:"u",email:null}});
    calls++;
    if(bearer==="Bearer old")return Response.json({error:"expired"},{status:401});
    return Response.json({error:"No report has been recorded"},{status:404});
  }) as typeof fetch;
  try {
    const api=new TerrevoWebApi();
    api.setSession({accessToken:"old",refreshToken:"old-refresh",expiresIn:3600,user:{id:"u",email:null}});
    api.setTenant(TENANT);
    // A missing RCPA report is a normal empty result, not a reason to sign a user out.
    assert.equal(await api.rcpa("44444444-4444-4444-8444-444444444444"),null);
    assert.equal(api.connected,true);
    assert.equal(calls,2);
  } finally { globalThis.fetch=prior; }
});

test("unplanned call retries preserve caller operation identity and tenant scope",async()=>{
 const previous=globalThis.fetch,seen:string[]=[];
 globalThis.fetch=(async(path:RequestInfo|URL,init?:RequestInit)=>{
  assert.equal(String(path),"/api/v1/unplanned-calls");
  assert.equal(new Headers(init?.headers).get("x-tenant-id"),TENANT);
  assert.equal(new Headers(init?.headers).get("authorization"),"Bearer "+SESSION.accessToken);
  const body=JSON.parse(String(init?.body));seen.push(body.operationId);
  return Response.json({call:{id:"call",status:"SUBMITTED"}});
 }) as typeof fetch;
 try{
  const api=new TerrevoWebApi();api.setSession(SESSION);api.setTenant(TENANT);
  const op="77777777-7777-4777-8777-777777777777";
  const input={operationId:op,executionId:"66666666-6666-4666-8666-666666666666",
   territoryId:"44444444-4444-4444-8444-444444444444",customerType:"doctor" as const,
   customerId:"55555555-5555-4555-8555-555555555555",reason:"Urgent visit",
   remarks:"Spoke to doctor",durationMinutes:25,latitude:17.38,longitude:78.48,accuracyMeters:12};
  await api.submitUnplannedCall(input);await api.submitUnplannedCall(input);
  assert.deepEqual(seen,[op,op]);
 }finally{globalThis.fetch=previous;}
});
