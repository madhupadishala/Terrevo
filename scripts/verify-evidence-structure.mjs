import fs from "node:fs";
import path from "node:path";

const manifestArg = process.argv[2] || process.env.PRODUCT_GATE_MANIFEST;
if (!manifestArg) {
  console.error("Missing evidence manifest.");
  process.exit(1);
}
const manifestPath = path.resolve(manifestArg);
const policyPath = path.resolve("governance/product-gates.json");
const failures = [];
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const validEvidence = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);

if (!fs.existsSync(manifestPath)) {
  console.error(`Evidence manifest does not exist: ${manifestArg}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const exemptible = new Set(policy.exemptibleAutomatedChecks || []);

if (manifest.schemaVersion !== 1) failures.push("schemaVersion must be 1");
if (!nonempty(manifest.changeId)) failures.push("changeId is required");
if (!Array.isArray(manifest.requirementIds) || manifest.requirementIds.length === 0) failures.push("requirementIds are required");
if (new Set(manifest.requirementIds || []).size !== (manifest.requirementIds || []).length) failures.push("requirementIds must be unique");
if (!/^[0-9a-f]{40}$/.test(manifest.exactCommit || "")) failures.push("exactCommit must be a full 40-character SHA");

for (const gate of policy.gates) {
  const result = manifest.gates?.[gate.id];
  if (!result) {
    failures.push(`missing gate: ${gate.id}`);
    continue;
  }
  if (!policy.statuses.includes(result.status)) {
    failures.push(`invalid status for gate ${gate.id}: ${result.status}`);
    continue;
  }
  if (!nonempty(result.reviewer)) failures.push(`gate ${gate.id} missing reviewer`);
  if (result.status === "PASS" && !validEvidence(result.evidence)) failures.push(`gate ${gate.id} PASS requires nonempty string evidence entries`);
  if (result.status === "NOT_APPLICABLE" && !nonempty(result.rationale)) failures.push(`gate ${gate.id} NOT_APPLICABLE requires rationale`);
}

for (const check of policy.automatedChecks) {
  const status = manifest.automatedChecks?.[check];
  if (!status) {
    failures.push(`missing automated check: ${check}`);
    continue;
  }
  if (!policy.statuses.includes(status)) failures.push(`invalid status for automated check ${check}: ${status}`);
  if (status === "NOT_APPLICABLE") {
    if (!exemptible.has(check)) failures.push(`automated check ${check} cannot be NOT_APPLICABLE`);
    const applicability = manifest.automatedCheckApplicability?.[check];
    if (!nonempty(applicability?.reviewer) || !nonempty(applicability?.rationale)) failures.push(`automated check ${check} NOT_APPLICABLE requires reviewer and rationale`);
  }
}

const artifactGroups = manifest.artifacts && typeof manifest.artifacts === "object" ? Object.values(manifest.artifacts) : [];
for (const group of artifactGroups) {
  if (!Array.isArray(group)) continue;
  for (const item of group) {
    if (!nonempty(item)) continue;
    if (/^(https?:\/\/|[A-Za-z ]+:)/.test(item)) continue;
    if (!fs.existsSync(path.resolve(item))) failures.push(`referenced artifact does not exist: ${item}`);
  }
}

if (!manifest.rollback || typeof manifest.rollback.documented !== "boolean") failures.push("rollback.documented boolean is required");

if (failures.length) {
  console.error("EVIDENCE STRUCTURE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`EVIDENCE STRUCTURE: PASS — ${manifest.changeId}`);
