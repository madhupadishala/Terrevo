# Sprint 24 — Regression + UAT + Closure

## Requirement IDs
- TRV-UAT-001: Release candidates shall pass foundation, typecheck, API tests, web build, and runtime verification.
- TRV-UAT-002: Mobile release candidates shall pass typecheck, unit tests, and Android production bundle smoke.
- TRV-UAT-003: Every forward database migration shall have a rollback partner and the full migration set shall apply forward then reverse on PostgreSQL 16.
- TRV-UAT-004: Release readiness shall fail when required sprint requirements, release controls, or rollback artifacts are missing.
- TRV-UAT-005: Critical business workflows shall have a traceable regression source or an explicit manual UAT scenario.
- TRV-UAT-006: Manual UAT items shall never be marked passed without recorded tester, date, build, and evidence reference.
- TRV-UAT-007: Pilot promotion shall require a green automated closure gate plus completed blocking manual UAT evidence.

## Scope Lock
- Responsible area: regression orchestration, UAT evidence, closure controls.
- Allowed paths: `docs/requirements/sprint-24-regression-uat-closure.md`, `docs/qa/**`, `scripts/verify-release-readiness.mjs`, `.github/workflows/release-gate.yml`, `package.json`.
- Forbidden paths: business logic, database schema except inherited migrations, UI redesign, new product features.
- UI CHANGE: NO
- DATABASE CHANGE: NO
- API CONTRACT CHANGE: NO

## Four-principle gate
- Karpathy: closure is evidence, not another feature sprint.
- Ponytail: reuse existing CI/test suites; add orchestration, not duplicate frameworks.
- Warpath: release fails closed on missing rollback, missing requirements, focused tests, or incomplete blocking UAT.
- CodeRabbit: independent review required before merge.

## Closure definition
Sprint 24 implementation is complete when the automated release gate exists and is green. Human/device UAT is a separate evidence input to that gate and must not be fabricated.

## Rollback
Revert Sprint 24 workflow/script/documentation commits. No runtime state is changed.
