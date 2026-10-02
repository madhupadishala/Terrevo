import fs from "node:fs";
import path from "node:path";

const checkId = process.argv[2];
const outputKey = process.argv[3] || "";
if (!["design_verification","browser_verification"].includes(checkId)) {
  console.error("Usage: node scripts/resolve-check-applicability.mjs <design_verification|browser_verification> [output-key]");
  process.exit(1);
}
if (outputKey && !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(outputKey)) {
  console.error("Invalid output key");
  process.exit(1);
}

const emit = required => {
  if (!process.env.GITHUB_OUTPUT) return;
  if (outputKey) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`${outputKey}=${required ? "run" : "skip"}\n`);
  } else {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`required=${required ? "true" : "false"}\n`);
  }
};

const nonempty = value => typeof value === "string" && value.trim().length > 0;
const prBody = process.env.PR_BODY || "";
const match = prBody.match(/^- Evidence manifest: `([^`]+)`\s*$/m);
if (!match) {
  console.error("Evidence manifest path missing from PR body");
  process.exit(1);
}

const repoRoot = fs.realpathSync(process.cwd());
const evidenceRoot = fs.realpathSync(path.join(repoRoot,"docs/evidence"));
const candidate = path.resolve(repoRoot, match[1]);

let manifestReal;
try {
  manifestReal = fs.realpathSync(candidate);
} catch {
  console.error("Evidence manifest does not exist");
  process.exit(1);
}

if (!manifestReal.startsWith(evidenceRoot + path.sep) || !manifestReal.endsWith(".product-gates.json")) {
  console.error("Evidence manifest must resolve inside docs/evidence and end in .product-gates.json");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestReal,"utf8"));
if (typeof manifest.impact?.ui !== "boolean") {
  console.error("impact.ui must be boolean");
  process.exit(1);
}

const status = manifest.automatedChecks?.[checkId];
if (status === "PASS") {
  if (manifest.impact.ui !== true) {
    console.error(`${checkId} PASS requires impact.ui=true`);
    process.exit(1);
  }
  emit(true);
  console.log(`${checkId}: REQUIRED`);
  process.exit(0);
}

if (status === "NOT_APPLICABLE") {
  const applicability = manifest.automatedCheckApplicability?.[checkId];
  if (!nonempty(applicability?.reviewer) || !nonempty(applicability?.rationale)) {
    console.error(`${checkId} NOT_APPLICABLE requires reviewer and rationale`);
    process.exit(1);
  }
  if (manifest.impact.ui !== false) {
    console.error(`${checkId} cannot be NOT_APPLICABLE when impact.ui=true`);
    process.exit(1);
  }
  emit(false);
  console.log(`${checkId}: REVIEWED NOT_APPLICABLE — ${applicability.reviewer}: ${applicability.rationale}`);
  process.exit(0);
}

console.error(`${checkId} must be PASS or reviewed NOT_APPLICABLE; found ${status || "missing"}`);
process.exit(1);
