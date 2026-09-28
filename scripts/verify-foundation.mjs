import { access } from "node:fs/promises";
const required = [
  "AGENTS.md",
  ".coderabbit.yaml",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml",
  ".agents/skills/ponytail/SKILL.md",
  ".agents/skills/warpath/SKILL.md",
  ".agents/skills/coderabbit-review/SKILL.md",
  "docs/architecture/ADR-001-modular-monolith.md",
  "docs/architecture/ADR-002-zero-cost-pilot.md",
  "docs/architecture/ADR-003-change-control.md",
  "docs/qa/SPRINT-GATE.md",
  "docs/requirements/README.md",
  "apps/mobile/.gitkeep",
  "apps/web/.gitkeep",
  "apps/api/.gitkeep",
  "modules/.gitkeep",
  "packages/domain/.gitkeep",
  "packages/contracts/.gitkeep",
  "packages/testing/.gitkeep"
];
const missing = [];
for (const path of required) {
  try { await access(path); } catch { missing.push(path); }
}
if (missing.length) {
  console.error("Foundation verification failed:", missing.join(", "));
  process.exit(1);
}
console.log(`Foundation verified: ${required.length} required paths present.`);
