import fs from "node:fs";
import path from "node:path";

const manifestArg = process.argv[2] || process.env.PRODUCT_GATE_MANIFEST;
if (!manifestArg) {
  console.error("Missing evidence manifest. Usage: npm run verify:product-gates -- docs/evidence/<manifest>.json");
  process.exit(1);
}

const policy = JSON.parse(fs.readFileSync(path.resolve("governance/product-gates.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestArg), "utf8"));
const failures = [];
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const validEvidence = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);

if (!/^[0-9a-f]{40}$/.test(manifest.exactCommit || "")) failures.push("exactCommit must be a full 40-character commit SHA");

for (const gate of policy.gates) {
  const result = manifest.gates?.[gate.id];
  if (!result) {
    failures.push(`missing gate: ${gate.id}`);
    continue;
  }
  if (!["PASS", "NOT_APPLICABLE"].includes(result.status)) failures.push(`${gate.id} is ${result.status || "missing"}, not qualified`);
  if (!nonempty(result.reviewer)) failures.push(`${gate.id} missing reviewer`);
  if (result.status === "PASS" && !validEvidence(result.evidence)) failures.push(`${gate.id} PASS requires nonempty string evidence entries`);
  if (result.status === "NOT_APPLICABLE" && !nonempty(result.rationale)) failures.push(`${gate.id} NOT_APPLICABLE requires rationale`);
}

const exemptible = new Set(policy.exemptibleAutomatedChecks || []);
for (const check of policy.automatedChecks) {
  const status = manifest.automatedChecks?.[check];
  if (status === "PASS") continue;
  if (status !== "NOT_APPLICABLE") {
    failures.push(`automated check ${check} is ${status || "missing"}; PASS required unless explicitly exemptible`);
    continue;
  }
  if (!exemptible.has(check)) {
    failures.push(`automated check ${check} cannot be NOT_APPLICABLE`);
    continue;
  }
  const applicability = manifest.automatedCheckApplicability?.[check];
  if (!nonempty(applicability?.reviewer) || !nonempty(applicability?.rationale)) {
    failures.push(`automated check ${check} NOT_APPLICABLE requires reviewer and rationale`);
  }
}

if (manifest.finalQualification?.status !== "COMPLETE") failures.push("finalQualification.status must be COMPLETE");
if (!nonempty(manifest.finalQualification?.qualifiedBy)) failures.push("finalQualification.qualifiedBy is required");
if (!nonempty(manifest.finalQualification?.qualifiedAt)) failures.push("finalQualification.qualifiedAt is required");
if (!manifest.rollback?.documented) failures.push("rollback must be documented");
if (!validEvidence(manifest.rollback?.evidence)) failures.push("rollback requires nonempty string evidence entries");

if (failures.length) {
  console.error("PRODUCT GATES: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`PRODUCT GATES: PASS — ${manifest.changeId} / ${manifest.exactCommit}`);
