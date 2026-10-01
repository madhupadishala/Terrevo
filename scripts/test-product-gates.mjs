import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const policy = JSON.parse(fs.readFileSync("governance/product-gates.json", "utf8"));
const base = {
  schemaVersion: 1,
  changeId: "TRV-TEST-001",
  sprint: "Verifier Test",
  requirementIds: ["TRV-TEST-001"],
  exactCommit: "a".repeat(40),
  owner: "test",
  reviewers: ["test"],
  impact: {},
  artifacts: {},
  automatedChecks: Object.fromEntries(policy.automatedChecks.map(id => [id, "PASS"])),
  automatedCheckApplicability: {},
  gates: Object.fromEntries(policy.gates.map(g => [g.id, {status:"PASS", reviewer:"test", evidence:["test"], rationale:""}])),
  rollback: {documented:true, tested:false, evidence:["test rollback"]},
  finalQualification: {status:"COMPLETE", qualifiedBy:"test", qualifiedAt:"2026-10-01T00:00:00Z"}
};

const run = manifest => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terrevo-gates-"));
  const file = path.join(dir, "manifest.json");
  fs.writeFileSync(file, JSON.stringify(manifest));
  return spawnSync(process.execPath, ["scripts/verify-product-gates.mjs", file], {encoding:"utf8"});
};

assert.equal(run(structuredClone(base)).status, 0, "valid manifest should pass");

for (const bad of [null, "", "   ", 42, {}]) {
  const m=structuredClone(base);
  m.gates.karpathy.evidence=[bad];
  assert.notEqual(run(m).status, 0, "invalid PASS evidence must fail");
}

{
  const m=structuredClone(base);
  m.automatedChecks.typecheck="NOT_APPLICABLE";
  assert.notEqual(run(m).status, 0, "mandatory automated check cannot be exempted");
}

{
  const m=structuredClone(base);
  m.automatedChecks.relevant_e2e="NOT_APPLICABLE";
  assert.notEqual(run(m).status, 0, "exemptible check requires reviewed applicability");
  m.automatedCheckApplicability.relevant_e2e={reviewer:"test",rationale:"No E2E surface changed."};
  assert.equal(run(m).status, 0, "reviewed exemptible check should pass");
}

console.log("PRODUCT GATE VERIFIER TESTS: PASS");
