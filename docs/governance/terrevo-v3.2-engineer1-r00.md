# TERREVO V3.2 — Engineer 1 R00 production engineering gate

Status: **MANDATORY / NOT YET QUALIFIED**  
Applies to R01, R03, R04-A, R05, R06-A, R10-A, R11-A and R12-A.
Owner: Engineer 1 / Chat 1. Reviewer acceptance is separate from implementation.

## Architecture and ownership
- Preserve React/Vite TypeScript web stack and existing API/domain/persistence boundaries. Maintain typed, versioned, validated API inputs and outputs with structured errors.
- Engineer 1 owns backend, database, integration shell, mobile, CI/security and deployment controls. Engineer 2 exclusively owns the UI feature directories and tests named in `docs/parallel/terrevo-chat2-wave2-contract.md`. No edits to Engineer 2-owned files.
- Engineer 2 packages connect via reviewed, tenant-aware typed callbacks/adapters; no direct browser database privileges and no invented routes, records or approved content.
- Document architectural changes, decisions, shared dependencies and identified risks.

## Evidence gates — all mandatory per sprint
For each sprint, link:
1. Specific requirements and acceptance criteria mapped to implementation and tests.
2. Code review/CodeRabbit findings and resolutions, owned-file diff, exact branch and commit SHA.
3. Unit, integration, database, server authorization, negative and browser E2E test results; failures and regressions tracked.
4. Real service verification, including test identities, environment, dated command/results, without secrets or PII.
5. Security and data integrity evidence: RLS, BOLA/IDOR, tenant/role enforcement, token expiry/revocation, input validation, foreign keys, indexes and transaction boundaries.
6. Reliability evidence: idempotent critical writes, concurrent requests, duplicate submission, network loss, retry storms, rollback/recovery and database restore on a safe test environment.
7. Mobile evidence where applicable: representative devices, GPS permissions/accuracy/unavailability, resumed sessions, durable offline queue and conflict resolution if promised.
8. Observability evidence: request correlation, structured redacted logs, errors, audit events and diagnostic/runbook references.
9. Pilot-measured API latencies, error rates, concurrent MR load and high-usage query plans against recorded acceptance thresholds; never claim estimated capacity as measurement.
10. Residual risk list, authorized reviewer decision and explicit deployment authorization.

A missing item remains **NOT VERIFIED** or **BLOCKED**, not PASS. A PR, merged commit or green CI cannot independently close a sprint.

## Release safety
- Develop/test locally before any managed deployment; no quota-consuming auto deployment.
- Use only no-cost, commercially permitted services inside approved limits. Do not provision paid staging/preview resources, exceed quotas, or copy production secrets.
- Maintain forward and rollback SQL migrations; backup AND execute a safe restore test. Protect field GPS, receipts and personally identifiable data.
- Freeze exact commit; qualify staging and production configurations separately; obtain independent UAT and human go/no-go; perform manual production deployment, smoke testing and rollback readiness verification.
- No claims of production qualification while live-device GPS, offline, infrastructure, recovery, independent review or required UAT are outstanding.

## Sprint-specific minimums
| Sprint | Acceptance evidence |
|---|---|
| R01 | Canonical branch/commit, reconciled PR baseline, owned-file manifest, build/test reproducibility |
| R03 | Isolated Supabase staging, authorized identities, RLS, migration up/down, backup/restore demonstration; blocked until approved zero-cost path exists |
| R04-A | Real API/persistence read/write traces, typed/versioned contracts, transaction/idempotency/concurrent write tests |
| R05 | Live authorized MR journey: plan, tour, GPS, planned/unplanned, NCA, DCR, end tour; reload/relogin and offline network recovery |
| R06-A | Manager/Admin actual review/approval, role and tenant negative cases, audit trails |
| R10-A | Threat model, security tests, tokens/session, secret/dependency checks, pilot-load performance and observability |
| R11-A | Verified Engineer 2 UI contract adapters, stale state isolation, actual data provenance, cross-module regression |
| R12-A | Exact-SHA release package, local/staging checks, device UAT, approved manual release, production smoke and rollback evidence |

## Evidence record template
```yaml
sprint: RXX
branch:
commit_sha:
changed_paths: []
requirements: []
tests:
  unit: NOT_VERIFIED
  integration: NOT_VERIFIED
  database: NOT_VERIFIED
  authorization: NOT_VERIFIED
  e2e: NOT_VERIFIED
  failure_recovery: NOT_VERIFIED
live_services: NOT_VERIFIED
security_integrity: NOT_VERIFIED
performance: NOT_VERIFIED
mobile_gps_offline: NOT_APPLICABLE
recovery_restore: NOT_VERIFIED
residual_risks: []
reviewer:
review_decision: PENDING
deployment_approval: NOT_GRANTED
status: OPEN
```

## Baseline at creation (2026-10-11)
Existing release issue #59 says staging Supabase is not provisioned, preview backend secrets are not configured and the live production release is unqualified. This document establishes gates only; it does not claim that checks were executed.
