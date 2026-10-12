import test from "node:test";import assert from "node:assert/strict";import {qualifyR04B} from "../qualify-r04b-auth.mjs";
const env={TERREVO_ENVIRONMENT:"staging",TERREVO_STAGING_PROJECT_REF:"eirlubfbjexjilvskqxq",SUPABASE_URL:"https://eirlubfbjexjilvskqxq.supabase.co/",SUPABASE_PUBLISHABLE_KEY:"public",TERREVO_R04B_ALPHA_EMAIL:"a@example.invalid",TERREVO_R04B_ALPHA_PASSWORD:"test-password-a",TERREVO_R04B_BETA_EMAIL:"b@example.invalid",TERREVO_R04B_BETA_PASSWORD:"test-password-b",TERREVO_STAGING_API_ORIGIN:"http://localhost:3000/"};
const ids={a:"10000000-0000-4000-8000-000000000101",b:"10000000-0000-4000-8000-000000000102"};
test("qualification exercises two actual token flows, both tenant denials, refresh and relogin without emitting credentials",async()=>{
 let aLogin=0,bLogin=0,refresh=0;const calls=[];
 const fetcher=async(input,init={})=>{
  const url=new URL(String(input)),auth=new Headers(init.headers).get("authorization")??"";
  if(url.pathname==="/auth/v1/token"){let who,access;
   if(url.searchParams.get("grant_type")==="refresh_token"){refresh++;who="a";access="a-refreshed";}
   else {const body=JSON.parse(init.body);who=body.email===env.TERREVO_R04B_ALPHA_EMAIL?"a":"b";if(who==="a")aLogin++;else bLogin++;access=who+"-token";}
   return Response.json({user:{id:who+"-id"},access_token:access,refresh_token:who+"-refresh"});
  }
  if(url.pathname.includes("/v1/business/customer-links/")){
   const t=new Headers(init.headers).get("x-tenant-id"),who=auth.startsWith("Bearer a-")?"a":"b";
   calls.push([who,t]);if(t!==ids[who])return Response.json({error:"denied"},{status:403});
   const evidenceId=who==="a"?"30000000-0000-4000-8000-000000000301":"30000000-0000-4000-8000-000000000304";
   return Response.json({links:[{id:evidenceId}]});
  }
  throw Error("Unexpected URL: "+url.pathname);
 };
 const result=await qualifyR04B(env,fetcher);assert.equal(result.passed,true);assert.equal(result.checks.length,6);assert.equal(aLogin,2);assert.equal(bLogin,1);assert.equal(refresh,1);assert.deepEqual(calls.map(x=>x[0]+":"+x[1]),["a:"+ids.a,"b:"+ids.b,"a:"+ids.b,"b:"+ids.a,"a:"+ids.a,"a:"+ids.a]);
});
