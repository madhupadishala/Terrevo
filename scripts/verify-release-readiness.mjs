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
  try { entries = await readdir(testDir); } catch { continue; }
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
