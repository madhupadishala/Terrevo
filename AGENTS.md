# Terrevo Agent Constitution

All coding agents must read this file before changing the repository.

## Core rule
Plan -> isolate -> build -> test -> review -> freeze -> integrate.

## Scope lock before edits
Before changing code, state:
- requirement/task ID
- responsible module
- allowed paths
- forbidden paths
- expected files
- UI change: YES/NO
- database change: YES/NO
- API contract change: YES/NO
- security/tenant impact
- offline/sync impact

Do not modify files outside declared scope. If scope must expand, stop and revise it first.

## Surgical changes
Do not refactor, rename, reformat, redesign, upgrade dependencies, reorganize folders, or improve adjacent code unless explicitly required.
Approved UI is frozen. If UI CHANGE = NO, layout, labels, typography, spacing, colors, navigation and responsive behavior must remain unchanged.

## Module boundaries
Modules communicate through explicit commands, queries, events and contracts. A module must not mutate another module's internal state.

## Ponytail rule
Stop at the first safe rung:
1. No code needed.
2. Existing repository code solves it.
3. Runtime/platform/native capability solves it.
4. Existing dependency solves it.
5. Small local implementation solves it.
6. Only then add an abstraction/dependency.

Safety, validation, authorization, auditability, tenant isolation, idempotency, offline recovery and tests are never removed for simplicity.

## Data and tenant safety
Cross-tenant access is release-blocking. Submitted business records are not silently overwritten. Prefer additive migrations. Every synchronizable mutation must be idempotent.

## Offline-first
Each mobile mutation needs an operation ID, local state, retry policy, conflict strategy and server acknowledgement.

## Tests
Run affected tests before changes when they exist. After changes run typecheck, lint, unit, integration, relevant E2E and visual regression when UI is involved. Never delete/skip/weaken tests merely to make CI green.

## Reviews
Repository-local skills are authoritative:
- `skills/ponytail/SKILL.md` is the default simplicity discipline.
- `skills/ponytail-review/SKILL.md` reviews over-engineering before merge.
- `skills/warpath/SKILL.md` is the adversarial blast-radius/release gate.
- `skills/code-review/SKILL.md` and `skills/autofix/SKILL.md` are the official vendored CodeRabbit skills.

Before merge: Ponytail review -> Warpath gate -> CodeRabbit when available -> resolve blocking findings -> rerun tests.
Do not claim a manual review came from CodeRabbit.

## Deployment
No deployment from an unreviewed feature branch. Deployment requires CI PASS, Warpath GO, rollback plan, migrations verified and environment smoke tests.

## Completion report
Report files changed/why, tests, UI/DB/API changes, security/offline impact, known risks, and unrelated changes.
