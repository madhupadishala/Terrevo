import test from "node:test";
import assert from "node:assert/strict";
import {createHandler}from "../src/handler.ts";
const tenant="f6000000-0000-4000-8000-000000000001";
const a="f6000000-0000-4000-8000-000000000002",b="f6000000-0000-4000-8000-000000000003";
test("concurrent administrative writes attribute only their own authenticated actor",async()=>{
 const actors:string[]=[];let authenticated=0;let release!:()=>void;
 const barrier=new Promise<void>(resolve=>{release=resolve;});
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input)),headers=new Headers(init?.headers);
  assert.ok(init?.signal);assert.equal(init?.redirect,"error");
  if(url.pathname==="/auth/v1/user"){
   const id=headers.get("authorization")==="Bearer a"?a:b;
   authenticated++;if(authenticated===2)release();await barrier;
   return Response.json({id,email:"synthetic@example.invalid"});
  }
  if(url.pathname==="/rest/v1/rpc/has_permission")return Response.json(true);
  if(url.pathname==="/rest/v1/tenants"&&init?.method==="PATCH"){
   assert.equal(headers.get("apikey"),"server-test-key");
   actors.push(headers.get("x-terrevo-actor")??"");return new Response(null,{status:204});
  }
  if(url.pathname==="/rest/v1/tenants")return Response.json([{id:tenant}]);
  throw Error("Unexpected provider path");
 };
 const handler=createHandler({SUPABASE_URL:"https://provider.example.invalid",SUPABASE_ANON_KEY:"public-test-key",SUPABASE_SERVICE_ROLE_KEY:"server-test-key"},{fetcher});
 const responses=await Promise.all(["a","b"].map(token=>handler(new Request("https://api.example.invalid/v1/field-settings",{method:"PUT",headers:{authorization:"Bearer "+token,"x-tenant-id":tenant,"x-terrevo-actor":"forged-caller"},body:JSON.stringify({geofenceRadiusMeters:100,maxGpsAccuracyMeters:50})}))));
 assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.deepEqual(actors.sort(),[a,b].sort());
});
