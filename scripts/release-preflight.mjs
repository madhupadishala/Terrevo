import { readFile, access } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { resolve } from "node:path";

// Static, local-first release preflight. This NEVER deploys, mutates a database,
// reads cloud secrets or claims that a mock test qualifies production.
const root = resolve(import.meta.dirname, "..");
const file = async (name) => readFile(resolve(root, name), "utf8");
const requiredFiles = [
  "apps/api/src/handler.ts",
  "apps/api/src/supabase-adapter.ts",
  "apps/web/src/App.tsx",
  "apps/web/src/terrevo-api.ts",
  "apps/web/src/MonthlyPlanner.tsx",
  "apps/web/src/features/customer360/Customer360View.tsx",
  "apps/web/src/features/activities/ActivitiesView.tsx",
  "apps/web/src/features/edetailing/EDetailingView.tsx",
  "apps/web/src/features/intelligence/TodayIntelligenceView.tsx",
  "apps/web/e2e/operations.spec.ts",
  "apps/web/e2e/delegated-integration.spec.ts",
  "apps/web/e2e/nca-flow.spec.ts",
  "apps/web/e2e/planned-unplanned-flow.spec.ts",
  "database/ci/platform-admin-policy-tests.sql",
  "database/ci/unplanned-call-integration-tests.sql",
  "database/ci/unplanned-call-policy-tests.sql",
  "database/ci/nca-policy-tests.sql",
  "database/ci/public-definer-privileges-tests.sql",
  "database/migrations/9997_unplanned_call_review.sql",
  "database/migrations/9998_nca_controlled_field_activities.sql",
  "database/migrations/9999_platform_admin_control_plane.sql",
  "database/migrations/0024_lockdown_public_definers.sql",
  "database/migrations/0025_immutable_function_search_paths.sql",
  "docs/requirements/planned-unplanned-call-qualification.md",
  "docs/requirements/nca-controlled-field-activities.md",
];
const failures = [];
for (const p of requiredFiles) {
  try { await access(resolve(root,p)); }
  catch { failures.push(`Missing release contract or test: ${p}`); }
}
const vercel=JSON.parse(await file("vercel.json"));
if (vercel.git?.deploymentEnabled !== false) {
  failures.push("Automatic Vercel Git deployments must be disabled; releases require explicit approval.");
}
if (vercel.outputDirectory !== "apps/web/dist" || vercel.buildCommand !== "npm run build") {
  failures.push("Production Vercel build/output config changed: requalify the runtime before releasing.");
}
const pkg=JSON.parse(await file("package.json"));
if (!pkg.scripts?.verify?.includes("typecheck") || !pkg.scripts?.verify?.includes("build")) {
  failures.push("Static verification no longer includes TypeScript/build gates.");
}
for(const [p,markers] of [
 ["apps/api/src/handler.ts",["/v1/unplanned-calls","/v1/unplanned-approvals","/v1/nca/options","/v1/platform/context"]],
 ["apps/web/src/terrevo-api.ts",["submitUnplannedCall","reviewUnplannedCall","saveNcaDraft","platformTenants"]],
 ["apps/web/src/App.tsx",["<Customer360View","<ActivitiesView","<EDetailingView","<TodayIntelligenceView"]],
 ["database/migrations/9997_unplanned_call_review.sql",["enable row level security","admin_submit_unplanned_call","admin_decide_unplanned_call"]],
 ["database/migrations/9998_nca_controlled_field_activities.sql",["enable row level security","admin_create_nca","admin_submit_nca"]],
 ["database/migrations/9999_platform_admin_control_plane.sql",["platform_admin_grants","security definer"]],
]){
 const text=await file(p);
 for(const fragment of markers){
  if(!text.toLowerCase().includes(fragment.toLowerCase()))failures.push(`Missing release marker ${JSON.stringify(fragment)} in ${p}`);
 }
}
const workflow=await file(".github/workflows/ci.yml");
for(const expected of ["foundation:","mobile:","browser-smoke:","database-migrations:","scope-lock:","unplanned-call-integration-tests.sql"]){
 if(!workflow.includes(expected))failures.push(`Required CI gate absent: ${expected}`);
}
if(failures.length){
 for(const failure of failures)console.error("FAIL:",failure);
 process.exitCode=1;
}else{
 console.log(`STATIC RELEASE PREFLIGHT PASSED (${requiredFiles.length} contracts/tests).`);
 console.log("No cloud systems were contacted or modified.");
 console.log("NOT A DEPLOYMENT APPROVAL: real staging, role/GPS UAT, security review and exact-SHA manual deploy remain separate gates.");
}
