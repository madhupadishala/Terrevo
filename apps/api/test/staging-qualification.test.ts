import test from "node:test";
import assert from "node:assert/strict";
import {createHandler,runtimeQualificationProof} from "../src/handler.ts";

const TENANT="11111111-1111-4111-8111-111111111111";
const STAGING="abcdefghijklmnopqrst";
const PRODUCTION="dfqsnkmmumvjwmvtnlcs";
const base={SUPABASE_URL:`https://${STAGING}.supabase.co`,TERREVO_ENVIRONMENT:"staging",VERCEL_ENV:"preview"};

test("staging attestation derives from server-only source URL and deployment metadata",()=>{
 assert.deepEqual(runtimeQualificationProof(base,TENANT),
 {environment:"staging",projectRef:STAGING,tenantId:TENANT});
});
test("production URL or production Vercel runtime cannot be described as staging",()=>{
 for(const env of [
 {...base,SUPABASE_URL:`https://${PRODUCTION}.supabase.co`},
 {...base,VERCEL_ENV:"production"},
 {...base,TERREVO_ENVIRONMENT:"production"},
 {...base,TERREVO_ENVIRONMENT:undefined},
 {...base,SUPABASE_URL:"http://"+STAGING+".supabase.co"},
 {...base,SUPABASE_URL:"https://evil.example.invalid"},
 ]){
  assert.equal(runtimeQualificationProof(env,TENANT).environment,"unverified");
 }
});
test("runtime qualification endpoint rejects a missing or invalid bearer token",async()=>{
 const fetcher=(async(input:RequestInfo|URL)=>{
  if(new URL(String(input)).pathname==="/auth/v1/user")
    return Response.json({message:"Unauthorized"},{status:401});
  return Response.json({error:"Unexpected provider endpoint"},{status:500});
 }) as typeof fetch;
 const handler=createHandler({...base,SUPABASE_PUBLISHABLE_KEY:"test-public-key"},{fetcher});
 for(const headers of [
  {"x-tenant-id":TENANT},
  {authorization:"Bearer invalid","x-tenant-id":TENANT},
 ]){
  const response=await handler(new Request("https://example.invalid/v1/qualification/target",{headers}));
  assert.equal(response.status,401);
 }
});
