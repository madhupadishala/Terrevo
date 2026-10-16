import test from "node:test";
import assert from "node:assert/strict";
import { verifyStagingTarget, PRODUCTION_PROJECT_REF } from "../verify-staging-target.mjs";
const stagingRef = "abcdefghijklmnopqrst";
const safe = {TERREVO_ENVIRONMENT:"staging",TERREVO_STAGING_PROJECT_REF:stagingRef,SUPABASE_URL:`https://${stagingRef}.supabase.co`};
test("staging guard accepts only an explicitly matched isolated project",()=>{
  assert.deepEqual(verifyStagingTarget(safe),{environment:"staging",projectRef:stagingRef});
});
test("staging guard refuses primary production project even when labeled staging",()=>{
  assert.throws(()=>verifyStagingTarget({...safe,TERREVO_STAGING_PROJECT_REF:PRODUCTION_PROJECT_REF,SUPABASE_URL:`https://${PRODUCTION_PROJECT_REF}.supabase.co`}),/PRODUCTION/);
});
test("staging guard refuses missing or incorrect environment/project reference",()=>{
  for(const env of [
    {...safe,TERREVO_ENVIRONMENT:"production"},
    {...safe,TERREVO_STAGING_PROJECT_REF:""},
    {...safe,SUPABASE_URL:`https://${PRODUCTION_PROJECT_REF}.supabase.co`},
    {...safe,SUPABASE_URL:"http://"+stagingRef+".supabase.co"},
    {...safe,SUPABASE_URL:"https://localhost"},
    {...safe,SUPABASE_URL:`https://${stagingRef}.supabase.co/unexpected`},
  ])assert.throws(()=>verifyStagingTarget(env));
});
