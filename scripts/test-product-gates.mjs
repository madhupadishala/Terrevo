import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const policy = JSON.parse(fs.readFileSync("governance/product-gates.json", "utf8"));

const gateEvidence = gate => Object.fromEntries(gate.evidence.map(item => [item, [`test:${item}`]]));

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
    }
  },
  artifacts: {},
  automatedChecks: Object.fromEntries(policy.automatedChecks.map(id => [id, "PASS"])),
  automatedCheckApplicability: {},
  gates: Object.fromEntries(policy.gates.map(g => [
    g.id,
    {status:"PASS", reviewer:"test", evidence:gateEvidence(g), rationale:""}
  ])),
  rollback: {documented:true, tested:false, evidence:["test rollback"]},
  finalQualification: {status:"COMPLETE", qualifiedBy:"test", qualifiedAt:"2026-10-01T00:00:00Z"}
};

const writeManifest = manifest => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terrevo-gates-"));
  const file = path.join(dir, "manifest.json");
  fs.writeFileSync(file, JSON.stringify(manifest));
  return file;
};

const runFinal = manifest =>
  spawnSync(process.execPath, ["scripts/verify-product-gates.mjs", writeManifest(manifest)], {encoding:"utf8"});

const runStructure = manifest =>
  spawnSync(process.execPath, ["scripts/verify-evidence-structure.mjs", writeManifest(manifest)], {encoding:"utf8"});

assert.equal(runFinal(structuredClone(base)).status, 0, "valid manifest should pass final verifier");
assert.equal(runStructure(structuredClone(base)).status, 0, "valid manifest should pass structure verifier");

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
  m.automatedChecks.relevant_e2e="NOT_APPLICABLE";
  assert.notEqual(runFinal(m).status,0,"exemptible check requires reviewed applicability");
  m.automatedCheckApplicability.relevant_e2e={reviewer:"test",rationale:"No E2E surface changed."};
  assert.equal(runFinal(m).status,0,"reviewed exemptible check should pass");
}
{
  const m=structuredClone(base);
  m.impact.ui=true;
  m.gates.product_design.status="NOT_APPLICABLE";
  m.gates.product_design.rationale="incorrect exemption";
  m.automatedChecks.design_verification="NOT_APPLICABLE";
  m.automatedChecks.browser_verification="NOT_APPLICABLE";
  m.automatedCheckApplicability.design_verification={reviewer:"test",rationale:"incorrect"};
  m.automatedCheckApplicability.browser_verification={reviewer:"test",rationale:"incorrect"};
  assert.notEqual(runFinal(m).status,0,"UI impact cannot exempt design/browser qualification");
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
  m.gates.coderabbit.status="NOT_APPLICABLE";
  m.gates.coderabbit.rationale="incorrect exemption";
  assert.notEqual(runFinal(m).status,0,"CodeRabbit gate is non-exemptible");
}

console.log("PRODUCT GATE VERIFIER TESTS: PASS");
