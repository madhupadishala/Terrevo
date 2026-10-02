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
const validEvidenceList = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const impactKeys = ["ui","database","apiContract","securityTenant","offlineSync","regulatoryDomain"];
const nonExemptibleGates = new Set(policy.nonExemptibleGates || []);
const exemptible = new Set(policy.exemptibleAutomatedChecks || []);

const loadAutomatedRuns = () => {
  try {
    if (process.env.AUTOMATED_CHECK_RUNS_FILE) {
      return JSON.parse(fs.readFileSync(process.env.AUTOMATED_CHECK_RUNS_FILE, "utf8"));
    }
    if (process.env.AUTOMATED_CHECK_RUNS_JSON) {
      return JSON.parse(process.env.AUTOMATED_CHECK_RUNS_JSON);
    }
  } catch (error) {
    failures.push(`automated check-run evidence is invalid JSON: ${error.message}`);
  }
  return null;
};

if (!/^[0-9a-f]{40}$/.test(manifest.exactCommit || "")) {
  failures.push("exactCommit must be a full 40-character commit SHA");
}

if (!isRecord(manifest.impact)) {
  failures.push("impact must be an object");
} else {
  for (const key of impactKeys) {
    if (typeof manifest.impact[key] !== "boolean") failures.push(`impact.${key} must be boolean`);
  }
}

for (const gate of policy.gates) {
  const result = manifest.gates?.[gate.id];
  if (!result) {
    failures.push(`missing gate: ${gate.id}`);
    continue;
  }

  if (!["PASS", "NOT_APPLICABLE"].includes(result.status)) {
    failures.push(`${gate.id} is ${result.status || "missing"}, not qualified`);
  }
  if (nonExemptibleGates.has(gate.id) && result.status !== "PASS") {
    failures.push(`${gate.id} is non-exemptible and must be PASS`);
  }
  if (!nonempty(result.reviewer)) failures.push(`${gate.id} missing reviewer`);

  if (result.status === "PASS") {
    if (!isRecord(result.evidence)) {
      failures.push(`${gate.id} PASS evidence must be keyed by required evidence item`);
    } else {
      for (const required of gate.evidence) {
        if (!validEvidenceList(result.evidence[required])) {
          failures.push(`${gate.id} missing required evidence: ${required}`);
        }
      }
    }
  }

  if (result.status === "NOT_APPLICABLE" && !nonempty(result.rationale)) {
    failures.push(`${gate.id} NOT_APPLICABLE requires rationale`);
  }
}

if (manifest.gates?.coderabbit?.status === "PASS" && process.env.CODERABBIT_REVIEW_VERIFIED !== "true") {
  failures.push("coderabbit PASS requires trusted clean approval and zero unresolved review threads for exactCommit");
}

const automatedRuns = loadAutomatedRuns();
const actionsProducer = policy.trustedProducers?.githubActions || {};
const checkRuns = Array.isArray(automatedRuns?.check_runs) ? automatedRuns.check_runs : [];

for (const check of policy.automatedChecks) {
  const status = manifest.automatedChecks?.[check];

  if (status === "PASS") {
    const bindings = policy.automatedCheckBindings?.[check];
    if (!Array.isArray(bindings) || bindings.length === 0) {
      failures.push(`automated check ${check} PASS has no trusted job binding`);
      continue;
    }
    if (!automatedRuns) {
      failures.push(`automated check ${check} PASS requires exact-commit GitHub check-run evidence`);
      continue;
    }

    for (const jobName of bindings) {
      const latest = checkRuns
        .filter(run =>
          run?.name === jobName &&
          run?.head_sha === manifest.exactCommit &&
          run?.app?.id === actionsProducer.appId &&
          run?.app?.slug === actionsProducer.slug
        )
        .sort((a, b) => {
          const aCompleted = Date.parse(a?.completed_at || "") || 0;
          const bCompleted = Date.parse(b?.completed_at || "") || 0;
          if (aCompleted !== bCompleted) return aCompleted - bCompleted;
          return (a?.id || 0) - (b?.id || 0);
        })
        .at(-1);

      if (!latest || latest.status !== "completed" || latest.conclusion !== "success") {
        failures.push(`automated check ${check} lacks trusted successful latest exact-commit job: ${jobName}`);
      }
    }
    continue;
  }

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

const impact = isRecord(manifest.impact) ? manifest.impact : {};

if (impact.ui === true) {
  if (manifest.gates?.product_design?.status !== "PASS") failures.push("UI impact requires Product Design Guardian PASS");
  for (const check of ["design_verification","browser_verification"]) {
    if (manifest.automatedChecks?.[check] !== "PASS") failures.push(`UI impact requires automated check ${check} PASS`);
  }
}

if (impact.database === true) {
  if (manifest.automatedChecks?.integration_tests !== "PASS") failures.push("database impact requires integration_tests PASS");
  for (const key of policy.impactRequirements?.database?.requiredEvidenceKeys || []) {
    if (!validEvidenceList(manifest.impactEvidence?.database?.[key])) {
      failures.push(`database impact requires evidence: ${key}`);
    }
  }
}

if (impact.securityTenant === true) {
  if (manifest.gates?.hacker?.status !== "PASS") failures.push("security/tenant impact requires Hacker Gate PASS");
  if (manifest.automatedChecks?.security !== "PASS") failures.push("security/tenant impact requires security automated check PASS");
}

if (impact.regulatoryDomain === true && manifest.gates?.regulatory_knowledge?.status !== "PASS") {
  failures.push("regulatory domain impact requires Regulatory Knowledge Gate PASS");
}

if (manifest.finalQualification?.status !== "COMPLETE") failures.push("finalQualification.status must be COMPLETE");
if (!nonempty(manifest.finalQualification?.qualifiedBy)) failures.push("finalQualification.qualifiedBy is required");
if (!nonempty(manifest.finalQualification?.qualifiedAt)) failures.push("finalQualification.qualifiedAt is required");
if (manifest.rollback?.documented !== true) failures.push("rollback must be documented");
if (!validEvidenceList(manifest.rollback?.evidence)) failures.push("rollback requires nonempty string evidence entries");

if (failures.length) {
  console.error("PRODUCT GATES: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PRODUCT GATES: PASS — ${manifest.changeId} / ${manifest.exactCommit}`);
