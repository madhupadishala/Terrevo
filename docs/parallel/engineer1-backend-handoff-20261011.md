# Engineer 1 backend handoff — 2026-10-11

Source: `chore/r01-repository-consolidation`, continuing from `9cec0cd8be76f364b93872fc0693c4547e67efaf`. All routes below exist in `apps/api/src/handler.ts`; browser transport adds `/api`. Bearer authentication and the authorized `x-tenant-id` are mandatory. Server identity and permission checks remain authoritative. This is a contract index, not live HTTP acceptance evidence.

## Canonical boundaries and ownership

| Boundary | Canonical implementation | Owner |
|---|---|---|
| HTTP and request validation | `apps/api/src/handler.ts`, `modules/security/src/index.ts` | Engineer 1 |
| Domain rules and TypeScript contracts | `modules/<domain>/src/index.ts` | Engineer 1 |
| Provider persistence | `apps/api/src/supabase-adapter.ts` | Engineer 1 |
| Schema, constraints, atomic commands and RLS | `database/migrations/**` | Engineer 1 |
| Shared authenticated browser transport | `apps/web/src/terrevo-api.ts` | Engineer 1 |
| Integration shell | `apps/web/src/App.tsx`, shared workspace components | Engineer 1 |
| Customer relationships, controlled CLM, workforce evidence, manager reporting feature folders and matching scoped tests | Exact paths in `terrevo-chat2-wave2-contract.md` | Engineer 2 exclusively |

No alternative services or new framework were introduced. Forward/rollback migrations intentionally replace versioned database functions; these historical definitions are not duplicate runtime services. Existing merged UI handoffs #51–#54 remain in the integration baseline. Wave 2 #60–#63 remain separate and unmerged.

## Field and manager API register

| Workflow | Existing versioned routes | Response / authority |
|---|---|---|
| Authorized plans | `GET/POST /v1/tour-plans`, existing detail/submit routes | Canonical tour-planning types; approved plan stops are reused |
| Plan approval | `GET /v1/tour-approvals`, `POST /v1/tour-approvals/:id/decision` | Scoped manager approval; server decision transaction |
| Start | `GET /v1/tour-executions/start-options`, `POST /v1/tour-executions/start` | `{options}` / `201 {execution}`; `StartTourCommand`, `TourExecution` |
| Resume/progress | `GET /v1/tour-executions/active`, `GET /v1/tour-executions/progress` | Persisted execution and derived stop state |
| Planned visit | `POST /v1/visits/check-in`, `POST /v1/visits/:id/check-out` | `{visit}`; owned execution, approved stop, location evidence |
| Doctor call/DCR | Existing doctor-call routes; `GET /v1/dcrs` | Doctor call captured before checkout; DCR generated transactionally |
| Unplanned call | `POST /v1/unplanned-calls`, `GET /v1/unplanned-calls/own` | `201 {call}` / `{calls}`; separate submitted ledger, not a completed planned visit |
| Unplanned review | `GET /v1/unplanned-approvals`, `POST /v1/unplanned-approvals/:id/decision` | `{calls}` / `{call}`; separate manager, immutable decision evidence |
| NCA | `GET /v1/nca/options`, `GET /v1/nca/own`, existing create/submit routes | Controlled catalogs and typed persistent NCA records |
| End day | `POST /v1/tour-executions/submit` | Persisted submitted execution; open visits/unresolved GPS block submission |
| Manager reporting | `GET /v1/manager/command-center`, `GET /v1/manager/analytics?days=7` | Scoped projections; bounded analytics window of 1–90 days |
| Governance | Existing `/v1/platform/context`, `/v1/platform/tenants`, status and audit routes | Independent verified platform grant; tenant admin does not imply platform admin |

For full request/response fields, consume the existing exported domain types and browser methods, not an independently copied schema. Existing HTTP paths, signatures and response shapes are unchanged by this delivery.

## Retry and location contract correction

`operationId` identifies one command payload. Keep the same UUID and normalized payload when retrying a lost response. Starting an already active execution now returns the stored execution after current territory permission is rechecked. Changed plan/GPS/device evidence under that UUID is a conflict. The database also binds start/check-in operation IDs to their persisted payloads and locks their owner row before resolving concurrent retries.

The database regression proves sequential replay, conflicting payload rejection and revoked permission rejection. CI additionally passed 16 independently launched connections per start/check-in/conflict race with one unchanged persisted execution and visit. Real interrupted HTTP sessions and representative API/device load remain unqualified. Location coordinates in test fixtures do not prove real device presence. Preserve `verification` and exception states; never replace them with a frontend success inference.

## Existing metric meanings

| Metric | Authoritative source / definition |
|---|---|
| Planned stops | Stops in tour days linked to scoped executions in the tenant-local rolling window |
| Completed visits | `field_visits.status='CHECKED_OUT'` joined to those executions and planned stops |
| Coverage percentage | Completed planned visits divided by planned stops; zero denominator returns zero |
| Submitted tours | Scoped `tour_executions.status='SUBMITTED'` in the rolling window |
| Doctor / chemist / stockist call counts | Completed planned visits split by stop type |
| Unique doctors | Distinct doctor IDs in scoped persisted DCRs |
| Short days / minutes | Submitted executions, persisted worked minutes compared with required minutes |
| Expense totals | SUBMITTED/APPROVED scoped claims grouped by currency; currencies are not summed together |

An existing aggregate does not provide immutable row-level as-of snapshots or export provenance. Unplanned submission/approval/rejection and NCA are distinct ledgers and must not be added to planned coverage without an approved metric contract. One completed planned doctor workflow was reconciled against the actual staging SQL projection; large-volume performance and all date-boundary cases remain open.

## Wave 2 contracts still missing

| Engineer 2 package | Backend gap verified from its `INTEGRATION_REQUEST.md` | Mounting condition |
|---|---|---|
| Customer relationships (#60) | Approved relationship edges, redacted patient-safe history, source access audit and pagination | Source-approved records and tenant/territory/subject authority available |
| CLM library (#61) | MLR approved asset/version catalog, product/region ACL, revocation, binary grants and idempotent session persistence | Server approval/version/active-visit authority verified |
| Workforce evidence (#62) | Receipt manifest ACL, approved policy versions, verified travel evidence and safe binary access | Server-backed owner/team scope, amounts, policy and evidence lineage verified |
| Manager reporting (#63) | Immutable consistent as-of row projection and reauthorized, audited CSV export | Snapshot semantics, deduplication, source lineage and export authorization verified |

Their typed props and callbacks remain intents until the backend work is assigned and accepted. Do not invent endpoints or adapt unrelated aggregate fields into these facts. Parent integration must rotate context keys, discard stale async responses, and reauthorize every source/export request server-side. No Engineer 2 files were edited or merged in this delivery.
