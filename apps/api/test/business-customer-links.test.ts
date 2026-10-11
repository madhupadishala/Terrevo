import test from "node:test";
import assert from "node:assert/strict";
import {createHandler} from "../src/handler.ts";
const tenant="10000000-0000-4000-8000-000000000101",owner="20000000-0000-4000-8000-000000000201",source="40000000-0000-4000-8000-000000000401";
const app=createHandler({SUPABASE_URL:"https://staging.example.invalid",SUPABASE_PUBLISHABLE_KEY:"public-key"},{
 fetcher:(async(input,init)=>{const url=new URL(String(input));const headers=new Headers(init?.headers);
 if(url.pathname==="/auth/v1/user")return headers.get("authorization")==="Bearer valid"?Response.json({id:owner,email:"test@example.invalid"}):Response.json({msg:"Bad token"},{status:401});
 if(url.pathname==="/rest/v1/tenants")return Response.json([{id:tenant}]);
 if(url.pathname==="/rest/v1/business_customer_link_grants"){assert.equal(headers.get("authorization"),"Bearer valid");assert.equal(url.searchParams.get("tenant_id"),"eq."+tenant);assert.equal(url.searchParams.get("user_id"),"eq."+owner);assert.ok(init?.signal);assert.equal(init?.redirect,"error");return Response.json([{territory_id:"north"}]);}
 if(url.pathname==="/rest/v1/business_customer_links"){assert.equal(headers.get("authorization"),"Bearer valid");assert.equal(url.searchParams.get("tenant_id"),"eq."+tenant);return Response.json([{id:"30000000-0000-4000-8000-000000000301",tenant_id:tenant,source_id:source,target_id:"50000000-0000-4000-8000-000000000501",territory_id:"north",relation:"associated",approval:"APPROVED",evidence_id:"proof",verified_at:"2026-10-11T07:00:00Z"}]);}
 return Response.json({error:"Unhandled "+url.pathname},{status:404});
 }) as typeof fetch
});
test("new route enforces authenticated tenant context and reads RLS-scoped customer links",async()=>{const r=await app(new Request("https://api.example.invalid/v1/business/customer-links/"+source,{headers:{authorization:"Bearer valid","x-tenant-id":tenant}}));const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));assert.equal(body.links.length,1);assert.equal(body.links[0].territoryId,"north");});
test("new route denies missing bearer token",async()=>{const r=await app(new Request("https://api.example.invalid/v1/business/customer-links/"+source,{headers:{"x-tenant-id":tenant}}));assert.notEqual(r.status,200);});
