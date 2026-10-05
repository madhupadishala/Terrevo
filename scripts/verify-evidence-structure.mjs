import fs from "node:fs";
import path from "node:path";

const manifestArg = process.argv[2] || process.env.PRODUCT_GATE_MANIFEST;
if (!manifestArg) {
  console.error("Missing evidence manifest.");
  process.exit(1);
}

const repoRoot = process.cwd();
const manifestPath = path.resolve(repoRoot, manifestArg);
const policyPath = path.resolve(repoRoot, "governance/product-gates.json");
const failures = [];
const nonempty = value => typeof value === "string" && value.trim().length > 0;
const validEvidenceList = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

if (!fs.existsSync(manifestPath)) {
  console.error(`Evidence manifest does not exist: ${manifestArg}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const exemptible = new Set(policy.exemptibleAutomatedChecks || []);
const nonExemptibleGates = new Set(policy.nonExemptibleGates || []);
const trustedWorkflowPath = policy.trustedProducers?.githubActions?.workflowPath;
const trustedWorkflowReviewer = policy.trustedProducers?.codeRabbit?.login;

if (manifest.schemaVersion !== 1) failures.push("schemaVersion must be 1");
if (!nonempty(manifest.changeId)) failures.push("changeId is required");
if (!Array.isArray(manifest.requirementIds) || manifest.requirementIds.length === 0 || !manifest.requirementIds.every(nonempty)) failures.push("requirementIds must be nonempty strings");
if (new Set(manifest.requirementIds || []).size !== (manifest.requirementIds || []).length) failures.push("requirementIds must be unique");
if (!/^[0-9a-f]{40}$/.test(manifest.exactCommit || "")) failures.push("exactCommit must be a full 40-character SHA");

const impactKeys=["ui","architecture","database","apiContract","securityTenant","offlineSync","regulatoryDomain"];
if (!isRecord(manifest.impact)) {
  failures.push("impact must be an object");
} else {
  for (const key of impactKeys) if (typeof manifest.impact[key] !== "boolean") failures.push(`impact.${key} must be boolean`);
}

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
  if (nonExemptibleGates.has(gate.id) && result.status === "NOT_APPLICABLE") failures.push(`gate ${gate.id} is non-exemptible and cannot be NOT_APPLICABLE`);
  if (!nonempty(result.reviewer)) failures.push(`gate ${gate.id} missing reviewer`);
  if (result.status === "PASS") {
    if (!isRecord(result.evidence)) {
      failures.push(`gate ${gate.id} PASS evidence must be an object`);
    } else {
      for (const required of gate.evidence) {
        if (!validEvidenceList(result.evidence[required])) failures.push(`gate ${gate.id} missing evidence for ${required}`);
      }
    }
  }
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
    if (!nonempty(applicability?.reviewer) || !nonempty(applicability?.rationale)) {
      failures.push(`automated check ${check} NOT_APPLICABLE requires reviewer and rationale`);
    }
  }
}

if (!isRecord(manifest.artifacts)) {
  failures.push("artifacts must be an object");
} else {
  for (const [name, group] of Object.entries(manifest.artifacts)) {
    if (!Array.isArray(group)) {
      failures.push(`artifact group ${name} must be an array`);
      continue;
    }
    for (const item of group) {
      if (!nonempty(item)) {
        failures.push(`artifact group ${name} contains an invalid entry`);
        continue;
      }
      if (/^https?:\/\//.test(item)) continue;
      const resolved = path.resolve(repoRoot, item);
      if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) {
        failures.push(`referenced artifact outside repository: ${item}`);
        continue;
      }
      if (!fs.existsSync(resolved)) failures.push(`referenced artifact does not exist: ${item}`);
    }
  }
}

if (!Array.isArray(manifest.trustedWorkflowChangeApprovals)) {
  failures.push("trustedWorkflowChangeApprovals must be an array");
} else {
  const seenWorkflowApprovals = new Set();
  for (const approval of manifest.trustedWorkflowChangeApprovals) {
    if (!isRecord(approval)) {
      failures.push("trustedWorkflowChangeApprovals entries must be objects");
      continue;
    }
    if (approval.path !== trustedWorkflowPath) failures.push(`untrusted workflow-change approval path: ${approval.path || "missing"}`);
    if (approval.reviewer !== trustedWorkflowReviewer) failures.push(`workflow-change approval reviewer must be ${trustedWorkflowReviewer}`);
    if (!nonempty(approval.rationale)) failures.push("workflow-change approval requires rationale");
    if (seenWorkflowApprovals.has(approval.path)) failures.push(`duplicate workflow-change approval: ${approval.path}`);
    seenWorkflowApprovals.add(approval.path);
  }
}

if (!isRecord(manifest.rollback) || typeof manifest.rollback.documented !== "boolean") failures.push("rollback.documented boolean is required");

if (failures.length) {
  console.error("EVIDENCE STRUCTURE: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`EVIDENCE STRUCTURE: PASS — ${manifest.changeId}`);
