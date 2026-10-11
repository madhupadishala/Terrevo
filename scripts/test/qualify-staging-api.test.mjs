import test from "node:test";
import assert from "node:assert/strict";
import { auditStagingApi, validateUatEnvironment } from "../qualify-staging-api.mjs";
import {PRODUCTION_PROJECT_REF} from "../verify-staging-target.mjs";

const T="11111111-1111-4111-8111-111111111111",O="22222222-2222-4222-8222-222222222222";
const ref="abcdefghijklmnopqrst";
const env={TERREVO_ENVIRONMENT:"staging",TERREVO_STAGING_PROJECT_REF:ref,
 SUPABASE_URL:`https://${ref}.supabase.co`,TERREVO_STAGING_API_ORIGIN:"http://127.0.0.1:3000",
 TERREVO_UAT_TENANT_ID:T,TERREVO_UAT_FOREIGN_TENANT_ID:O,
 TERREVO_MR_ACCESS_TOKEN:"mr-secret",TERREVO_MANAGER_ACCESS_TOKEN:"manager-secret",TERREVO_ADMIN_ACCESS_TOKEN:"admin-secret"};
function fixture({platformLeak=false,crossTenantLeak=false,missingManagerPermission=false}={}){
 const visits=[];
 const fetcher=async (url,opts)=>{
  const u=new URL(url),role={ "Bearer mr-secret":"MR","Bearer manager-secret":"MANAGER","Bearer admin-secret":"TENANT_ADMIN"}[opts.headers.authorization];
  const id=opts.headers["x-tenant-id"];
  visits.push({method:opts.method,path:u.pathname,role,tenant:id});
  if(opts.method!=="GET")throw Error("Unexpected write");
  const reply=(status,body)=>Response.json(body,{status});
  if(!role)return reply(401,{error:"Anonymous not authorized"});
  if(u.pathname==="/api/v1/tenants")return reply(200,{tenants:[{id:T}]});
  if(id===O&&crossTenantLeak)return reply(200,{context:{permissions:[]}});
  if(id===O)return reply(403,{error:"Other tenant"});
  if(u.pathname==="/api/v1/access-context"){
   const permissions=role==="MANAGER"&&!missingManagerPermission?["TOUR_APPROVE"]:
    role==="TENANT_ADMIN"?["MASTER_MANAGE"]:["TOUR_PLAN_OWN"];
   return reply(200,{context:{permissions}});
  }
  if(u.pathname==="/api/v1/platform/tenants")return platformLeak?reply(200,{tenants:[]}):reply(403,{error:"No platform grant"});
  if(u.pathname==="/api/v1/unplanned-calls/own")return reply(200,{calls:[]});
  if(u.pathname==="/api/v1/nca/options")return reply(200,{options:{categories:[],towns:[]}});
  if(u.pathname==="/api/v1/unplanned-approvals")return reply(200,{calls:[]});
  return reply(404,{error:"Unknown fixture request"});
 };
 return {fetcher,visits};
}
test("safe isolated preview or localhost accepted; production target, aliases and reused tokens rejected",()=>{
 assert.equal(validateUatEnvironment(env).tenantId,T);
 assert.equal(validateUatEnvironment({...env,TERREVO_STAGING_API_ORIGIN:"https://test-abc.vercel.app"}).tenantId,T);
 for(const bad of [
   {...env,TERREVO_STAGING_API_ORIGIN:"https://terrevo.vercel.app"},
   {...env,TERREVO_STAGING_API_ORIGIN:"https://example.com"},
   {...env,TERREVO_STAGING_API_ORIGIN:"http://example.com"},
   {...env,TERREVO_ENVIRONMENT:"production"},
   {...env,TERREVO_STAGING_PROJECT_REF:PRODUCTION_PROJECT_REF,SUPABASE_URL:`https://${PRODUCTION_PROJECT_REF}.supabase.co`},
   {...env,TERREVO_MANAGER_ACCESS_TOKEN:"mr-secret"},
   {...env,TERREVO_UAT_FOREIGN_TENANT_ID:T},
   {...env,TERREVO_MR_ACCESS_TOKEN:""},
   {...env,TERREVO_STAGING_API_ORIGIN:"https://staging.vercel.app/fake/path"},
 ])assert.throws(()=>validateUatEnvironment(bad));
});
test("GET-only staging pilot verifies authorized roles, denied platform access, foreign tenant and anonymous denial",async()=>{
 const mock=fixture(),outcome=await auditStagingApi(env,mock.fetcher);
 assert.equal(outcome.passed,true,JSON.stringify(outcome.failures));
 assert.equal(outcome.failures.length,0);
 assert.equal(outcome.missingEvidence.length,0);
 assert.ok(mock.visits.some(x=>x.role==="MANAGER"&&x.path.endsWith("/unplanned-approvals")));
 assert.ok(mock.visits.some(x=>x.role==="MR"&&x.tenant===O));
 assert.ok(mock.visits.every(x=>x.method==="GET"));
 // No secrets, customer data or raw bearer values in the resulting attestation.
 assert.ok(!JSON.stringify(outcome).includes("mr-secret"));
 assert.ok(!JSON.stringify(outcome).includes(T));
});
test("cross-tenant privilege escalation is a hard failure",async()=>{
 const mock=fixture({crossTenantLeak:true});const outcome=await auditStagingApi(env,mock.fetcher);
 assert.equal(outcome.passed,false);
 assert.ok(outcome.failures.some(x=>x.includes("Foreign tenant")));
});
test("platform leak or missing manager permission is a hard failure",async()=>{
 for(const options of [{platformLeak:true},{missingManagerPermission:true}]){
  const mock=fixture(options),outcome=await auditStagingApi(env,mock.fetcher);
  assert.equal(outcome.passed,false);
  assert.ok(outcome.failures.length>0);
 }
});
test("cross-tenant evidence cannot be silently omitted",async()=>{
 const mock=fixture(),outcome=await auditStagingApi({...env,TERREVO_UAT_FOREIGN_TENANT_ID:""},mock.fetcher);
 assert.equal(outcome.passed,false);
 assert.match(outcome.missingEvidence.join(" " ),/Cross-tenant denial/);
});
