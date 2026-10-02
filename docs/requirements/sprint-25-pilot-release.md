# Sprint 25 — Pilot Release

## Requirement IDs
- TRV-PILOT-001: A pilot release shall identify one immutable release version and source commit.
- TRV-PILOT-002: Pilot packaging shall run the full release-readiness gate and shall fail when blocking UAT evidence is incomplete.
- TRV-PILOT-003: The pilot artifact set shall contain web, API, Android export, and a machine-readable release manifest.
- TRV-PILOT-004: Pilot smoke shall verify health, no-store behavior, request correlation, and API security headers against the supplied pilot URL.
- TRV-PILOT-005: Pilot promotion shall be manually dispatched, use the GitHub `pilot` environment, and require an explicit release confirmation.
- TRV-PILOT-006: Pilot rollout shall have documented entry criteria, rollback decision rules, rollback steps, and post-release observation checks.
- TRV-PILOT-007: Pilot release tooling shall not contain provider secrets or bypass UAT/security gates.
- TRV-PILOT-008: A failed smoke/UAT/release gate shall stop promotion rather than downgrade or skip validation.
- TRV-PILOT-009: Automatic Vercel previews shall skip non-runtime commits and deploy only when web/API/runtime/database/build-contract files change; inability to determine change scope shall fail safe by allowing deployment.

## Scope Lock
- Responsible area: release packaging, smoke, pilot promotion controls, rollback runbook.
- Allowed paths: `docs/requirements/sprint-25-pilot-release.md`, `docs/deployment/PILOT-RELEASE.md`, `scripts/verify-uat-closure.mjs`, `scripts/create-release-manifest.mjs`, `scripts/smoke-pilot.mjs`, `scripts/vercel-ignore-build.mjs`, `.github/workflows/pilot-release.yml`, `vercel.json`, version metadata, `docs/SPRINT-STATUS.md`.
- Forbidden paths: domain behavior, database business schema, RBAC semantics, GPS logic, analytics formulas, sync queue behavior.
- UI CHANGE: NO
- DATABASE CHANGE: NO
- API CONTRACT CHANGE: NO

## Four-principle gate
- Karpathy: release only what already passed feature/security/regression work.
- Ponytail: artifact packaging and smoke scripts only; no second deployment platform.
- Warpath: incomplete UAT, wrong confirmation, failed build, or failed smoke blocks promotion.
- CodeRabbit: independent review required before merge.

## Rollback
Pilot rollback is operational, not a new migration: redeploy the previous known-good artifact/commit and apply database down migrations only when a release introduced DB changes that must be reversed.
