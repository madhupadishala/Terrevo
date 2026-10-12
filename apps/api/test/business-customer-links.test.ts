import test from "node:test";
import assert from "node:assert/strict";
import {createHandler} from "../src/handler.ts";
const tenant="10000000-0000-4000-8000-000000000101",owner="20000000-0000-4000-8000-000000000201",source="40000000-0000-4000-8000-000000000401";
test("HTTP local provider does not break unrelated routes and customer-links errors stay inside the boundary",async()=>{
 let calls=0;
 const local=createHandler({SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_PUBLISHABLE_KEY:"public-key"},{fetcher:async(input)=>{
  calls++;const path=new URL(String(input)).pathname;
  if(path==="/auth/v1/user")return Response.json({id:owner});
  if(path==="/rest/v1/tenants")return Response.json([{id:tenant}]);
  if(path==="/rest/v1/business_customer_link_grants")return Response.json([{territory_id:"north"}],{headers:{"content-range":"0-0/1"}});
  throw Error("unexpected request");
 }});
 assert.equal((await local(new Request("http://localhost/health"))).status,200);
 assert.equal(calls,0);
 const response=await local(new Request("http://localhost/v1/business/customer-links/"+source,{headers:{authorization:"Bearer valid","x-tenant-id":tenant}}));
 assert.equal(response.status,500);
 assert.equal(calls,3);
});
const app=createHandler({SUPABASE_URL:"https://staging.example.invalid",SUPABASE_PUBLISHABLE_KEY:"public-key"},{
 fetcher:(async(input,init)=>{const url=new URL(String(input));const headers=new Headers(init?.headers);
 if(url.pathname==="/auth/v1/user")return headers.get("authorization")==="Bearer valid"?Response.json({id:owner,email:"test@example.invalid"}):Response.json({msg:"Bad token"},{status:401});
 if(url.pathname==="/rest/v1/tenants")return Response.json([{id:tenant}]);
 if(url.pathname==="/rest/v1/business_customer_link_grants"){assert.equal(headers.get("authorization"),"Bearer valid");assert.equal(url.searchParams.get("tenant_id"),"eq."+tenant);assert.equal(url.searchParams.get("user_id"),"eq."+owner);assert.ok(init?.signal);assert.equal(init?.redirect,"error");return Response.json([{territory_id:"north"}],{headers:{"content-range":"0-0/1"}});}
 if(url.pathname==="/rest/v1/business_customer_links"){assert.equal(headers.get("authorization"),"Bearer valid");assert.equal(url.searchParams.get("tenant_id"),"eq."+tenant);return Response.json([{id:"30000000-0000-4000-8000-000000000301",tenant_id:tenant,source_id:source,target_id:"50000000-0000-4000-8000-000000000501",territory_id:"north",relation:"associated",approval:"APPROVED",evidence_id:"proof",verified_at:"2026-10-11T07:00:00Z"}]);}
 return Response.json({error:"Unhandled "+url.pathname},{status:404});
 }) as typeof fetch
});
test("new route enforces authenticated tenant context and reads RLS-scoped customer links",async()=>{const r=await app(new Request("https://api.example.invalid/v1/business/customer-links/"+source,{headers:{authorization:"Bearer valid","x-tenant-id":tenant}}));const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));assert.equal(body.links.length,1);assert.equal(body.links[0].territoryId,"north");});
test("new route denies missing bearer token",async()=>{const r=await app(new Request("https://api.example.invalid/v1/business/customer-links/"+source,{headers:{"x-tenant-id":tenant}}));assert.notEqual(r.status,200);});

function grantHarness(page:(offset:number)=>Response){
 const signals:AbortSignal[]=[];const offsets:number[]=[];let linkReads=0;
 const handler=createHandler({SUPABASE_URL:"https://staging.example.invalid",SUPABASE_PUBLISHABLE_KEY:"public-key"},{fetcher:async(input,init)=>{
  const url=new URL(String(input)),headers=new Headers(init?.headers);
  if(url.pathname==="/auth/v1/user")return Response.json({id:owner});
  if(url.pathname==="/rest/v1/tenants")return Response.json([{id:tenant}]);
  assert.equal(headers.get("authorization"),"Bearer valid");
  if(url.pathname==="/rest/v1/business_customer_link_grants"){
   assert.equal(url.searchParams.get("order"),"territory_id.asc");assert.equal(url.searchParams.get("limit"),"1000");
   assert.equal(url.searchParams.get("tenant_id"),"eq."+tenant);assert.equal(url.searchParams.get("user_id"),"eq."+owner);
   assert.equal(headers.get("prefer"),"count=exact");assert.equal(init?.redirect,"error");
   signals.push(init!.signal!);const offset=Number(url.searchParams.get("offset"));offsets.push(offset);return page(offset);
  }
  if(url.pathname==="/rest/v1/business_customer_links"){
   linkReads++;return Response.json([{id:"30000000-0000-4000-8000-000000000301",tenant_id:tenant,source_id:source,target_id:source,territory_id:"territory-1000",relation:"linked",approval:"APPROVED",evidence_id:"proof",verified_at:"2026-10-11T07:00:00Z"}]);
  }
  throw Error("Unexpected request");
 }});
 return {run:()=>handler(new Request("https://api.example.invalid/v1/business/customer-links/"+source,{headers:{authorization:"Bearer valid","x-tenant-id":tenant}})),offsets,signals,linkReads:()=>linkReads};
}
const grants=Array.from({length:1001},(_,i)=>({territory_id:`territory-${String(i).padStart(4,"0")}`}));
test("grant pagination includes territories beyond 1000 and handles lower provider caps",async()=>{
 for(const cap of [1000,200]){
  const h=grantHarness(offset=>{const rows=grants.slice(offset,offset+cap);return Response.json(rows,{headers:{"content-range":`${offset}-${offset+rows.length-1}/${grants.length}`}});});
  const response=await h.run();assert.equal(response.status,200);assert.equal((await response.json()).links.length,1);
  assert.ok(h.offsets.length>1);assert.equal(h.offsets.at(-1),1000);assert.equal(h.linkReads(),1);
  assert.ok(h.signals.every(signal=>signal===h.signals[0]));
 }
});
test("grant pagination fails before relationship reads on missing, inconsistent or repeated pages",async()=>{
 for(const variant of ["missing","unknown-count","bad-range","changed-count","repeated","failed","empty","overflow"]){
  const h=grantHarness(offset=>{
   if(variant==="overflow")return Response.json([grants[0]],{headers:{"content-range":"0-0/100001"}});
   if(offset===0)return Response.json(grants.slice(0,1000),{headers:{"content-range":"0-999/1001"}});
   if(variant==="failed")return Response.json({error:"denied"},{status:403});
   const range=variant==="missing"?undefined:variant==="unknown-count"?"1000-1000/*":variant==="bad-range"?"0-0/1001":variant==="changed-count"?"1000-1000/1002":"1000-1000/1001";
   return Response.json(variant==="empty"?[]:[variant==="repeated"?grants[0]:grants[1000]],{headers:range?{"content-range":range}:{}});
  });
  assert.equal((await h.run()).status,403,variant);assert.equal(h.linkReads(),0,variant);
 }
});
test("empty grant set and exhausted page bound cannot produce partial links",async()=>{
 const empty=grantHarness(()=>Response.json([],{headers:{"content-range":"*/0"}}));
 assert.equal((await empty.run()).status,403);assert.equal(empty.linkReads(),0);
 const bounded=grantHarness(offset=>Response.json([grants[offset]],{headers:{"content-range":`${offset}-${offset}/1001`}}));
 assert.equal((await bounded.run()).status,403);assert.equal(bounded.offsets.length,100);assert.equal(bounded.linkReads(),0);
});
