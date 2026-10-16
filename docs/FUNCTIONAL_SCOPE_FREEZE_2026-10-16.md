# Terrevo Functional Scope Freeze — 2026-10-16

Status: **FROZEN / ENGINEERING-ACCEPTED**

Reference implementation: `FunctionalQaProvider` and the accepted QA UI at commit `9ebc40c1673b2a4d8769dc616e7a07cef56f53bf`.

## Freeze rule

Authentication, provisioning, persistence and LiveApiProvider work MUST preserve the accepted UI fields, workflow transitions, validation behavior and downstream dependencies. A live API mismatch is fixed behind the provider/API boundary; accepted business UI is not rewritten unless this document is deliberately amended.

## Accepted workflows

| Module | Frozen behavior |
| --- | --- |
| CLM / detailing | Rehearsal is visit-independent and never contributes to DCR. Detailing requires checked-in doctor visit, approved content only, slide dwell evidence and doctor reaction linked to the visit. |
| Samples / gifts | Distribution requires checked-in doctor visit; positive whole quantity; available-balance guard; atomic balance decrement; visit/DCR evidence. |
| RCPA | Doctor visits blocked. Chemist visit requires Doctor→Chemist mapping. Quantities non-negative; market-share derived. |
| POB | Doctor visits blocked. Chemist requires Chemist→Stockist mapping; stockist requires mapped chemist; positive cart; idempotent immutable booking. |
| NCA | Controlled category/town masters; 30–600 minute duration; cannot overlap a same-date checked-in customer visit; DRAFT→SUBMITTED→APPROVED/REJECTED. |
| Workforce | Attendance history; overlapping leave prevention; expenses DRAFT→SUBMITTED→APPROVED/RETURNED/REJECTED; weekly timesheet submission/decision. |
| DCR | No free-standing creation. Derived from completed field activity and approved NCA. Submission requires closed visits and locks the day read-only. |
| Manager command | Metrics derived from team data. Pending tour/GPS/NCA/expense/leave queues mutate the underlying records through approve/return/reject actions. |

## Provider contract

UI reads/actions route through `TerrevoDataProvider`. `FunctionalQaProvider` remains the deterministic regression reference. Production cutover uses `LiveApiProvider` with matching semantics.

## Release gates

1. Identity/provisioning and role assignment.
2. Live provider parity for all frozen workflows.
3. Real isolated-user end-to-end qualification: MR → Manager plus cross-tenant denial.
4. Full CI, PostgreSQL integration and browser regression.
5. Promote exact validated SHA only.

Any change to this frozen contract requires an explicit scope-freeze amendment and new regression coverage.
