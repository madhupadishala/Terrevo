import { access } from "node:fs/promises";
const required = [
  "AGENTS.md",
  ".coderabbit.yaml",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml",
  "skills/ponytail/SKILL.md",
  "skills/ponytail-review/SKILL.md",
  "skills/ponytail-audit/SKILL.md",
  "skills/ponytail-debt/SKILL.md",
  "skills/ponytail-gain/SKILL.md",
  "skills/ponytail-help/SKILL.md",
  "skills/karpathy-guidelines/SKILL.md",
  "skills/warpath/SKILL.md",
  "skills/code-review/SKILL.md",
  "skills/code-review/references/auth-recovery.md",
  "skills/code-review/references/cli-workflows.md",
  "skills/autofix/SKILL.md",
  "skills/autofix/github.md",
  "THIRD_PARTY_NOTICES.md",
  "third_party/licenses/PONYTAIL-MIT.txt",
  "third_party/licenses/CODERABBIT-SKILLS-MIT.txt",
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
