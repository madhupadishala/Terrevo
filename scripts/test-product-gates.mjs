import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const policy = JSON.parse(fs.readFileSync("governance/product-gates.json", "utf8"));
const gateEvidence = gate => Object.fromEntries(gate.evidence.map(item => [item, [`test:${item}`]]));
const boundJobs = [...new Set(Object.values(policy.automatedCheckBindings || {}).flat())];

assert.deepEqual(
  policy.automatedCheckBindings?.design_verification,
  ["design-verification"],
  "design_verification must bind to the trusted design-verification GitHub Actions job"
);
assert.deepEqual(
  policy.automatedCheckBindings?.browser_verification,
  ["browser-verification"],
  "browser_verification must bind to the trusted browser-verification GitHub Actions job"
);
assert.equal(
  policy.trustedProducers?.githubActions?.slug,
  "github-actions",
  "automated check bindings must rely on the trusted GitHub Actions producer"
);

const base = {
  schemaVersion: 1,
  changeId: "TRV-TEST-001",
  sprint: "Verifier Test",
  requirementIds: ["TRV-TEST-001"],
  exactCommit: "a".repeat(40),
  owner: "test",
  reviewers: ["test"],
  impact: {
    ui: false,
    architecture: false,
    database: false,
    apiContract: false,
    securityTenant: false,
    offlineSync: false,
    regulatoryDomain: false
  },
  impactEvidence: {
    database: {
      forward_migration: ["test forward migration"],
      reverse_migration: ["test reverse migration"]
    },
    apiContract: { compatibility: ["test compatibility evidence"] },
    offlineSync: { retry: ["test retry evidence"], idempotency: ["test idempotency evidence"] }
  },
  artifacts: {},
  automatedChecks: Object.fromEntries(
    policy.automatedChecks.map(id => [
      id,
      (policy.automatedCheckBindings?.[id] || []).length ? "PASS" : "NOT_APPLICABLE"
    ])
  ),
  automatedCheckApplicability: Object.fromEntries(
    policy.automatedChecks
      .filter(id => !(policy.automatedCheckBindings?.[id] || []).length)
      .map(id => [id,{reviewer:"test",rationale:"No applicable automated surface in verifier fixture."}])
  ),
  gates: Object.fromEntries(policy.gates.map(g => [
    g.id,
    {status:"PASS", reviewer:"test", evidence:gateEvidence(g), rationale:""}
  ])),
  rollback: {documented:true, tested:false, evidence:["test rollback"]},
  finalQualification: {status:"COMPLETE", qualifiedBy:"test", qualifiedAt:"2026-10-01T00:00:00Z"}
};

const buildRuns = sha => {
  const check_runs = boundJobs.map((name,index) => ({
    id:index+1,name,head_sha:sha,status:"completed",conclusion:"success",completed_at:"2026-10-01T00:00:00Z",
    check_suite:{id:index+1000},
    app:{id:policy.trustedProducers.githubActions.appId,slug:policy.trustedProducers.githubActions.slug}
  }));
  return {total_count:check_runs.length,check_runs,workflow_runs:check_runs.map(run=>({id:run.id+10000,check_suite_id:run.check_suite.id,head_sha:sha,path:policy.trustedProducers.githubActions.workflowPath,event:policy.trustedProducers.githubActions.event}))};
};

const writeManifest = manifest => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terrevo-gates-"));
  const file = path.join(dir, "manifest.json");
  fs.writeFileSync(file, JSON.stringify(manifest));
  return file;
};

const runFinal = (
  manifest,
  {coderabbitVerified=true, runs=buildRuns(manifest.exactCommit)}={}
) =>
  spawnSync(
    process.execPath,
    ["scripts/verify-product-gates.mjs", writeManifest(manifest)],
    {
      encoding:"utf8",
      env:{
        ...process.env,
        CODERABBIT_REVIEW_VERIFIED: coderabbitVerified ? "true" : "false",
        AUTOMATED_CHECK_RUNS_JSON: JSON.stringify(runs)
      }
    }
  );

const runStructure = manifest =>
  spawnSync(process.execPath, ["scripts/verify-evidence-structure.mjs", writeManifest(manifest)], {encoding:"utf8"});

assert.equal(runFinal(structuredClone(base)).status, 0, "valid manifest should pass final verifier");
assert.equal(runStructure(structuredClone(base)).status, 0, "valid manifest should pass structure verifier");

{
  const m=structuredClone(base);
  assert.notEqual(runFinal(m,{coderabbitVerified:false}).status,0,"trusted CodeRabbit review must be required");
}
{
  const m=structuredClone(base);
  m.exactCommit="not-a-sha";
  assert.notEqual(runFinal(m).status,0,"invalid exactCommit must fail");
}
{
  const m=structuredClone(base);
  m.gates.karpathy.reviewer="";
  assert.notEqual(runFinal(m).status,0,"missing gate reviewer must fail");
}
{
  const m=structuredClone(base);
  m.gates.product_design.status="NOT_APPLICABLE";
  m.gates.product_design.rationale="";
  assert.notEqual(runFinal(m).status,0,"N/A gate without rationale must fail");
}
{
  const m=structuredClone(base);
  delete m.gates.coderabbit.evidence.unresolved_material_findings_zero;
  assert.notEqual(runFinal(m).status,0,"missing required gate evidence item must fail");
}
{
  const m=structuredClone(base);
  m.gates.coderabbit.status="NOT_APPLICABLE";
  m.gates.coderabbit.rationale="incorrect exemption";
  assert.notEqual(runFinal(m).status,0,"CodeRabbit gate is non-exemptible");
}
{
  const m=structuredClone(base);
  m.finalQualification.qualifiedBy="";
  assert.notEqual(runFinal(m).status,0,"missing qualifiedBy must fail");
}
{
  const m=structuredClone(base);
  m.rollback.evidence=[];
  assert.notEqual(runFinal(m).status,0,"empty rollback evidence must fail");
}
{
  const m=structuredClone(base);
  m.rollback.documented="true";
  assert.notEqual(runFinal(m).status,0,"rollback documented must be boolean true");
}
{
  const m=structuredClone(base);
  m.automatedChecks.typecheck="NOT_APPLICABLE";
  assert.notEqual(runFinal(m).status,0,"mandatory automated check cannot be exempted");
}
{
  const m=structuredClone(base);
  delete m.impact.offlineSync;
  assert.notEqual(runFinal(m).status,0,"missing impact field must fail");
}
{
  const m=structuredClone(base);
  m.impact.ui="false";
  assert.notEqual(runFinal(m).status,0,"non-boolean impact field must fail");
}
{
  const m=structuredClone(base);
  m.impact.ui=true;
  m.gates.product_design.status="NOT_APPLICABLE";
  m.gates.product_design.rationale="incorrect exemption";
  assert.notEqual(runFinal(m).status,0,"UI impact cannot exempt Product Design Guardian");
}
{
  const m=structuredClone(base);
  m.impact.database=true;
  m.impactEvidence.database.forward_migration=[];
  assert.notEqual(runFinal(m).status,0,"database impact requires forward migration evidence");
}
{
  const m=structuredClone(base);
  m.impact.securityTenant=true;
  m.automatedChecks.security="NOT_APPLICABLE";
  m.automatedCheckApplicability.security={reviewer:"test",rationale:"incorrect"};
  assert.notEqual(runFinal(m).status,0,"security/tenant impact cannot exempt security check");
}
{
  const m=structuredClone(base);
  const runs=buildRuns(m.exactCommit);
  runs.check_runs=runs.check_runs.filter(r=>r.name!=="foundation");
  assert.notEqual(runFinal(m,{runs}).status,0,"missing trusted job must fail automated PASS");
}
{
  const m=structuredClone(base);
  const runs=buildRuns(m.exactCommit);
  runs.check_runs[0].head_sha="b".repeat(40);
  assert.notEqual(runFinal(m,{runs}).status,0,"check run from wrong SHA must fail");
}
{
  const m=structuredClone(base);
  const runs=buildRuns(m.exactCommit);
  runs.check_runs[0].conclusion="failure";
  assert.notEqual(runFinal(m,{runs}).status,0,"failed check run must fail");
}
{
  const m=structuredClone(base);
  const runs=buildRuns(m.exactCommit);
  runs.check_runs[0].app.id=999;
  assert.notEqual(runFinal(m,{runs}).status,0,"untrusted GitHub App must fail");
}
{
  const m=structuredClone(base); const runs=buildRuns(m.exactCommit); runs.workflow_runs[0].path=".github/workflows/untrusted.yml";
  assert.notEqual(runFinal(m,{runs}).status,0,"check run from untrusted workflow must fail");
}
{
  const m=structuredClone(base); const runs=buildRuns(m.exactCommit);
  runs.check_runs.push({...structuredClone(runs.check_runs[0]),id:9999,status:"in_progress",conclusion:null,completed_at:null,check_suite:{id:9999}});
  assert.notEqual(runFinal(m,{runs}).status,0,"newer in-progress re-run must block PASS");
}
{
  const m=structuredClone(base); m.impact.architecture=true; m.gates.architecture.status="NOT_APPLICABLE"; m.gates.architecture.rationale="incorrect exemption";
  assert.notEqual(runFinal(m).status,0,"architecture impact requires Architecture Guardian PASS");
}
{
  const m=structuredClone(base); m.impact.apiContract=true; m.impactEvidence.apiContract.compatibility=[];
  assert.notEqual(runFinal(m).status,0,"API contract impact requires compatibility evidence");
}
{
  const m=structuredClone(base); m.impact.offlineSync=true; m.impactEvidence.offlineSync.idempotency=[];
  assert.notEqual(runFinal(m).status,0,"offline/sync impact requires idempotency evidence");
}
{
  const m=structuredClone(base);
  m.automatedChecks.relevant_e2e="NOT_APPLICABLE";
  assert.notEqual(runFinal(m,{coderabbitVerified:false}).status,0,"NOT_APPLICABLE automated check requires trusted CodeRabbit-reviewed applicability");
}
{
  const m=structuredClone(base);
  m.artifacts={architecture:"missing.md"};
  assert.notEqual(runStructure(m).status,0,"artifact group must be array");
}
{
  const m=structuredClone(base);
  m.artifacts={architecture:[null,""]};
  assert.notEqual(runStructure(m).status,0,"invalid artifact entries must fail");
}
{
  const m=structuredClone(base);
  m.artifacts={architecture:["../outside.md"]};
  assert.notEqual(runStructure(m).status,0,"artifact path traversal must fail");
}

console.log("PRODUCT GATE VERIFIER TESTS: PASS");
