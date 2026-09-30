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

if (!/^[0-9a-f]{40}$/.test(manifest.exactCommit || "")) failures.push("exactCommit must be a full 40-character commit SHA");

for (const gate of policy.gates) {
  const result = manifest.gates?.[gate.id];
  if (!result) { failures.push(`missing gate: ${gate.id}`); continue; }
  if (!["PASS", "NOT_APPLICABLE"].includes(result.status)) failures.push(`${gate.id} is ${result.status || "missing"}, not qualified`);
  if (!String(result.reviewer || "").trim()) failures.push(`${gate.id} missing reviewer`);
  if (result.status === "PASS" && (!Array.isArray(result.evidence) || result.evidence.length === 0)) failures.push(`${gate.id} PASS requires evidence`);
  if (result.status === "NOT_APPLICABLE" && !String(result.rationale || "").trim()) failures.push(`${gate.id} NOT_APPLICABLE requires rationale`);
}
for (const check of policy.automatedChecks) {
  const status = manifest.automatedChecks?.[check];
  if (!["PASS", "NOT_APPLICABLE"].includes(status)) failures.push(`automated check ${check} is ${status || "missing"}`);
}
if (manifest.finalQualification?.status !== "COMPLETE") failures.push("finalQualification.status must be COMPLETE");
if (!String(manifest.finalQualification?.qualifiedBy || "").trim()) failures.push("finalQualification.qualifiedBy is required");
if (!String(manifest.finalQualification?.qualifiedAt || "").trim()) failures.push("finalQualification.qualifiedAt is required");
if (!manifest.rollback?.documented) failures.push("rollback must be documented");

if (failures.length) {
  console.error("PRODUCT GATES: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`PRODUCT GATES: PASS — ${manifest.changeId} / ${manifest.exactCommit}`);
