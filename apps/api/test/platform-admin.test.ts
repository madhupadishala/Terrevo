import assert from "node:assert/strict";
import test from "node:test";
import { createHandler } from "../src/handler.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const TENANT = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const providerUrl = "https://db.example.invalid";
const config = { SUPABASE_URL: providerUrl, SUPABASE_PUBLISHABLE_KEY: "public-test-key", SUPABASE_SECRET_KEY: "secret-test-key" };
function createFixture(granted: boolean) {
  let privilegedCalls = 0;
  let authChecks = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const u = new URL(String(input));const headers = new Headers(init?.headers);
    if(u.pathname === "/auth/v1/user") {
      authChecks++;
      if(headers.get("authorization")!=="Bearer valid-token") return Response.json({message:"Unauthorized"},{status:401});
      return Response.json({id:OWNER,email:null});
    }
    if(u.pathname.startsWith("/rest/v1/")) {
      assert.equal(headers.get("authorization"),"Bearer secret-test-key");
      if(u.pathname==="/rest/v1/platform_admin_grants") return Response.json(granted?[{user_id:OWNER}]:[]);
      privilegedCalls++;
      if(u.pathname==="/rest/v1/tenants") return Response.json([{id:TENANT,name:"Test organization",slug:"test-org",status:"active"}]);
      if(u.pathname==="/rest/v1/platform_admin_audit") return Response.json([{id:1,actor_user_id:OWNER,tenant_id:TENANT,action:"TENANT_CREATED",occurred_at:"2026-10-10T00:00:00Z",details:{slug:"test-org"}}]);
      if(u.pathname==="/rest/v1/rpc/platform_create_tenant") {
        const body=JSON.parse(String(init?.body)) as Record<string,unknown>;
        assert.deepEqual(body,{p_actor_user_id:OWNER,p_name:"Example Pharma",p_slug:"example-pharma"});
        return Response.json({id:TENANT,name:body.p_name,slug:body.p_slug,status:"active"});
      }
      if(u.pathname==="/rest/v1/rpc/platform_set_tenant_status") {
        const body=JSON.parse(String(init?.body)) as Record<string,unknown>;
        assert.deepEqual(body,{p_actor_user_id:OWNER,p_tenant_id:TENANT,p_status:"inactive"});
        return Response.json({id:TENANT,name:"Test organization",slug:"test-org",status:"inactive"});
      }
    }
    return Response.json({message:"Unexpected provider endpoint"},{status:502});
  }) as typeof fetch;
  const handler=createHandler(config,{fetcher});
  function send(path: string, method="GET", body?:unknown, token="valid-token") {
    return handler(new Request("https://app.example.invalid"+path,{
      method,
      headers:{
        authorization:"Bearer "+token,
        "x-tenant-id":OTHER, // must never grant platform authority
        ...(body===undefined?{}:{"content-type":"application/json"}),
      },
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    }));
  }
  return {send, getPrivilegedCalls:()=>privilegedCalls,getAuthChecks:()=>authChecks};
}

test("platform endpoints require authenticated identity and ignore tenant-admin headers",async()=>{
  const fixture=createFixture(false);
  assert.equal((await fixture.send("/v1/platform/context","GET",undefined,"invalid")).status,401);
  const context=await fixture.send("/v1/platform/context");
  assert.equal(context.status,200);
  assert.deepEqual(await context.json(),{isSuperAdmin:false});
  const blocked=await fixture.send("/v1/platform/tenants");
  assert.equal(blocked.status,403);
  assert.equal((await fixture.send("/v1/platform/audit")).status,403);
  assert.equal((await fixture.send("/v1/platform/tenants","POST",{name:"Example Pharma",slug:"example-pharma"})).status,403);
  assert.equal(fixture.getPrivilegedCalls(),0);
});

test("platform role authorizes only authenticated actor and audited RPCs",async()=>{
  const fixture=createFixture(true);
  assert.deepEqual(await (await fixture.send("/v1/platform/context")).json(),{isSuperAdmin:true});
  const listed=await fixture.send("/v1/platform/tenants");
  assert.equal(listed.status,200);
  assert.equal((await listed.json() as {tenants:Array<{id:string}>}).tenants[0].id,TENANT);
  const created=await fixture.send("/v1/platform/tenants","POST",{name:"Example Pharma",slug:"example-pharma"});
  assert.equal(created.status,201);
  assert.equal((await created.json() as {tenant:{slug:string}}).tenant.slug,"example-pharma");
  const updated=await fixture.send("/v1/platform/tenants/"+TENANT+"/status","PATCH",{status:"inactive"});
  assert.equal(updated.status,200);
  assert.equal((await updated.json() as {tenant:{status:string}}).tenant.status,"inactive");
  const audit=await fixture.send("/v1/platform/audit");
  assert.equal(audit.status,200);
  assert.equal((await audit.json() as {events:unknown[]}).events.length,1);
  assert.equal(fixture.getPrivilegedCalls(),4);
});

test("platform mutation validation denies malformed input before RPC",async()=>{
  const fixture=createFixture(true);
  assert.equal((await fixture.send("/v1/platform/tenants","POST",{name:"X",slug:"INVALID SLUG"})).status,400);
  assert.equal((await fixture.send("/v1/platform/tenants/"+TENANT+"/status","PATCH",{status:"deleted"})).status,400);
  assert.equal((await fixture.send("/v1/platform/tenants?offset=-1")).status,400);
  assert.equal(fixture.getPrivilegedCalls(),0);
});
