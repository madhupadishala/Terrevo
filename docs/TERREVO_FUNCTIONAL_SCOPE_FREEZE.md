# TERREVO FUNCTIONAL SCOPE FREEZE — FINAL LIVE CUTOVER BASELINE

Status: **FROZEN / ACCEPTED**
Baseline purpose: protect the accepted Functional QA behavior while authentication, provisioning and live persistence are qualified.

## Release rule

The accepted UI, field schema, validation behavior and workflow transitions below are the reference contract. Authentication or backend implementation changes MUST satisfy the same `TerrevoDataContextValue` behavior. Business components are not to be rewritten to accommodate live persistence.

Production provider:
- default: `LiveApiProvider`
- deterministic QA: explicit `?qa=1`
- legacy authenticated-contract regression: explicit `?auth-test=1`

## Accepted functional matrix

| Module | Accepted behavior |
|---|---|
| CLM / Detailing | Rehearsal is visit-independent and creates no DCR evidence. Detailing requires a checked-in Doctor. Only approved/effective content is selectable. Slide dwell and reaction are linked to the visit. |
| Samples / Gifts | Distribution requires an active Doctor visit. Quantity must be >0 and <= available balance. Successful distribution decrements balance and becomes visit/DCR evidence. |
| RCPA | Disabled for Doctor visits. Chemist visit requires Doctor→Chemist relationship. Captures own/competitor observations and Rx evidence. |
| POB | Disabled for Doctor visits. Chemist/Stockist trade flow requires Chemist→Stockist relationship. Order booking uses an idempotency token. |
| NCA | Categories/towns are controlled masters. Duration 30–600 minutes. Same-day active customer check-in prevents NCA overlap. Workflow is DRAFT→SUBMITTED→APPROVED/REJECTED. |
| Workforce | Attendance is derived. Leave rejects overlaps. Expenses and timesheets retain controlled workflow states and manager decisions. |
| DCR | No disconnected DCR creation. DCR is derived from completed visit evidence and approved NCA. Submission is blocked while visits remain open and locks the finalized day. |
| Manager Command | Metrics and queues are derived from team records. Approve/Return/Reject changes the underlying record and recalculates queues. |
| Empty Tenant | All accepted modules render semantic zero states without fabricated records or console exceptions. |

## Provider contract freeze

The following provider surfaces are frozen for the final live cutover:

- `auth`: login, logout, tenant selection, Tenant Admin / Manager / MR provisioning
- `planning`: get/save/update/submit/decide
- `workday`: start/submit
- `visits`: check-in/close
- `clm`: start/finish
- `inventory`: distribute
- `rcpa`: save
- `pob`: book
- `nca`: save/submit/decide
- `workforce`: leave, expense, timesheet and manager decisions
- `dcr`: deterministic preview/submit
- `manager`: queue decision
- `relationships`: link/unlink

## Role boundary freeze

- Platform Super Admin: platform tenant lifecycle + initial Tenant Admin only.
- Tenant Admin: tenant hierarchy, users, role assignment, controlled masters.
- Manager: scoped team visibility and approvals; no cross-branch or cross-tenant access.
- MR: own planning/execution/evidence/workforce records within authorized scope.
- Outsider / non-member: no tenant records.

## Release gates

A final live-provider release is acceptable only when:
1. TypeScript, unit, web and production build pass.
2. All DB forward migrations and rollback migrations pass.
3. PostgreSQL cutover acceptance verifies field lifecycle, evidence snapshots, manager scope and outsider denial.
4. Browser regression verifies login/session refresh/logout, provider parity, provisioning contracts and accepted workflows.
5. Production defaults to `LiveApiProvider`; Functional QA remains explicit only.
6. Exact validated SHA is deployed.
