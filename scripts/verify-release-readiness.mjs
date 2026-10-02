import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const failures = [];
const requirePath = async (file) => {
  try { await access(file); }
  catch { failures.push(`missing required path: ${file}`); }
};

const requiredRequirements = [
  "docs/requirements/sprint-01-identity-tenant.md",
  "docs/requirements/sprint-02-organization-rbac.md",
  "docs/requirements/sprint-03-core-masters.md",
  "docs/requirements/sprint-04-tour-planning.md",
  "docs/requirements/sprint-05-tour-approval.md",
  "docs/requirements/sprint-06-start-my-tour.md",
  "docs/requirements/sprint-07-show-my-tour.md",
  "docs/requirements/sprint-08-gps-visits.md",
  "docs/requirements/sprint-09-doctor-call-dcr.md",
  "docs/requirements/sprint-10-samples-gifts.md",
  "docs/requirements/sprint-11-submit-tour.md",
  "docs/requirements/sprint-12-daily-timesheet.md",
  "docs/requirements/sprint-13-weekly-timesheet.md",
  "docs/requirements/sprint-14-trade-calls.md",
  "docs/requirements/sprint-15-rcpa.md",
  "docs/requirements/sprint-16-orders.md",
  "docs/requirements/sprint-17-attendance-leave.md",
  "docs/requirements/sprint-18-expenses.md",
  "docs/requirements/sprint-19-joint-work.md",
  "docs/requirements/sprint-20-manager-command.md",
  "docs/requirements/sprint-21-analytics-reports.md",
  "docs/requirements/sprint-22-offline-sync.md",
  "docs/requirements/sprint-23-security-audit.md",
  "docs/requirements/sprint-24-regression-uat-closure.md",
];

for (const file of requiredRequirements) await requirePath(file);
for (const file of [
  ".github/workflows/ci.yml",
  ".github/workflows/release-gate.yml",
  ".coderabbit.yaml",
  "docs/qa/SPRINT-GATE.md",
  "docs/qa/UAT-CLOSURE.md",
  "docs/qa/REGRESSION-MATRIX.md",
]) await requirePath(file);

const parseMarkdownRow = (line) =>
  line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((value) => value.trim());

const uatSource = await readFile("docs/qa/UAT-CLOSURE.md", "utf8");
const requiredUatIds = new Set(
  Array.from({ length: 16 }, (_, index) =>
    `UAT-${String(index + 1).padStart(2, "0")}`,
  ),
);
const seenUatIds = new Set();
for (const line of uatSource.split(/\r?\n/)) {
  if (!/^\|\s*UAT-\d{2}\s*\|/.test(line)) continue;
  const [id, scenario, expected, status, tester, timestamp, build, evidence] =
    parseMarkdownRow(line);

  if (!requiredUatIds.has(id)) {
    failures.push(`unexpected UAT scenario ID: ${id}`);
    continue;
  }
  if (seenUatIds.has(id)) {
    failures.push(`duplicate UAT scenario ID: ${id}`);
    continue;
  }
  seenUatIds.add(id);

  if (!["NOT RUN", "PASS", "FAIL"].includes(status)) {
    failures.push(`invalid UAT status for ${id}: ${status}`);
    continue;
  }

  if (!scenario || !expected) {
    failures.push(`incomplete UAT definition for ${id}`);
  }

  if (status === "PASS") {
    if (!tester) failures.push(`PASS UAT row missing tester: ${id}`);
    if (!timestamp) failures.push(`PASS UAT row missing UTC date/time: ${id}`);
    if (!build) failures.push(`PASS UAT row missing build/commit: ${id}`);
    if (!evidence) failures.push(`PASS UAT row missing evidence: ${id}`);
  }
} 

for (const id of requiredUatIds) {
  if (!seenUatIds.has(id)) failures.push(`missing blocking UAT scenario: ${id}`);
}

const regressionSource = await readFile("docs/qa/REGRESSION-MATRIX.md", "utf8");
for (const line of regressionSource.split(/\r?\n/)) {
  if (!line.startsWith("|")) continue;
  const [capability, automatedEvidence, manualUat] = parseMarkdownRow(line);
  if (
    !capability ||
    capability === "Capability" ||
    /^-+$/.test(capability.replace(/\s+/g, ""))
  ) {
    continue;
  }
  if (!automatedEvidence && !manualUat) {
    failures.push(`regression matrix row has no evidence reference: ${capability}`);
  }
}

const migrationDir = "database/migrations";
const migrations = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql"));
const forwards = migrations.filter((name) => !name.endsWith(".down.sql"));
for (const forward of forwards) {
  const rollback = forward.replace(/\.sql$/, ".down.sql");
  if (!migrations.includes(rollback)) failures.push(`missing rollback migration for ${forward}: ${rollback}`);
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
for (const script of ["verify:foundation", "typecheck", "test", "build", "verify"]) {
  if (!rootPackage.scripts?.[script]) failures.push(`missing root package script: ${script}`);
}

const mobilePackage = JSON.parse(await readFile("apps/mobile/package.json", "utf8"));
for (const script of ["typecheck", "test", "bundle:android"]) {
  if (!mobilePackage.scripts?.[script]) failures.push(`missing mobile package script: ${script}`);
}

for (const testDir of ["apps/api/test", "apps/mobile/test"]) {
  let entries = [];
  try {
    entries = await readdir(testDir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      failures.push(`missing required test directory: ${testDir}`);
      continue;
    }
    throw error;
  }
  for (const entry of entries.filter((name) => /\.test\.(ts|tsx|js|mjs)$/.test(name))) {
    const file = path.join(testDir, entry);
    const source = await readFile(file, "utf8");
    if (/\b(?:test|describe|it)\.only\s*\(/.test(source)) failures.push(`focused test committed: ${file}`);
  }
}

if (failures.length) {
  console.error("Release readiness verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release readiness verified: ${requiredRequirements.length} sprint requirement files, ${forwards.length} forward migrations with rollback partners, required release controls present.`);
