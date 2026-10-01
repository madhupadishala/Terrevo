# Wave 2 Requalification — Sprints 6–10

Status: **IMPLEMENTED / REQUALIFICATION IN PROGRESS**

Qualified implementation candidate: `031e58c96cea00ebf546cf35c669d7fb98319198`

## Scope

Wave 2 requalifies:

1. Sprint 6 — Start My Tour
2. Sprint 7 — Show My Tour
3. Sprint 8 — GPS Check-in / Check-out
4. Sprint 9 — Doctor Call + Automatic DCR
5. Sprint 10 — Samples + Gifts

This wave reuses existing runtime behavior where it is already correct and adds missing qualification proof instead of rewriting working code.

## Sprint 6 — Start My Tour

Evidence observed:
- approved owned plan-day requirement;
- tenant-local date validation;
- one execution per employee/work date;
- one ACTIVE execution at a time;
- idempotent start by operation UUID;
- server-authoritative start time;
- GPS/device/network/app evidence capture;
- 480-minute default stored on execution;
- tenant timezone validation.

Requalification additions:
- database proof that a second ACTIVE execution is rejected;
- direct-write privilege check on tour_executions.

Status: **IMPLEMENTED / NOT QUALIFIED** pending CI + CodeRabbit.

## Sprint 7 — Show My Tour

Evidence observed:
- active-tour projection only;
- server-time elapsed calculation;
- required / elapsed / remaining minutes;
- planned ordered stops;
- pending/in-progress/completed derivation;
- null projection when no active execution;
- dedicated service tests already exist.

Status: **IMPLEMENTED / NOT QUALIFIED** pending CI + CodeRabbit.

## Sprint 8 — GPS Check-in / Check-out

Evidence observed:
- active owned execution required;
- planned stop enforcement;
- tenant-configurable 50/100/200 m geofence;
- independent GPS accuracy threshold;
- VERIFIED / OUTSIDE_GEOFENCE / LOW_ACCURACY / NO_TARGET_COORDINATES;
- exception reason required for non-verified check-in;
- only one open visit per execution;
- idempotent check-in / checkout;
- manager exception review under TOUR_APPROVE;
- database-level self-review prevention;
- tour-progress state derives from visit records.

Requalification additions:
- database self-review abuse test;
- direct-write privilege check on field_visits.

Status: **IMPLEMENTED / NOT QUALIFIED** pending CI + CodeRabbit.

## Sprint 9 — Doctor Call + Automatic DCR

Evidence observed:
- doctor-call details are tied to checked-in doctor visit;
- required call outcome;
- up to 20 unique sequenced products;
- product/division validation in persistence layer;
- idempotent doctor-call save;
- doctor checkout blocked until call details exist;
- DCR snapshot created at doctor checkout;
- doctor/product/GPS state preserved in DCR;
- non-doctor visit checkout does not create DCR;
- owner/team read access.

Requalification additions:
- direct-write privilege check on doctor_calls;
- existing unit tests retained for duplicate products, save confirmation, and no fabricated DCR.

Status: **IMPLEMENTED / NOT QUALIFIED** pending CI + CodeRabbit.

## Sprint 10 — Samples + Gifts

Evidence observed:
- employee/item inventory balance tables with non-negative constraints;
- scoped INVENTORY_MANAGE authorization;
- item must belong to employee division and be active;
- own-return flow;
- doctor-visit distribution;
- 1–20 unique lines, atomic DB operation;
- idempotency request hashes;
- insufficient-balance protection;
- immutable ledger rows with resulting balance;
- DCR distribution snapshots;
- own/team read scope.

Requalification additions:
- replay of same inventory operation proves one ledger event;
- same operation UUID with different payload is rejected;
- over-return is rejected;
- balance remains non-negative;
- direct-write privilege check on inventory_balances.

Status: **IMPLEMENTED / NOT QUALIFIED** pending CI + CodeRabbit.

## Product Design Guardian

Wave 2 requalification changes no product UI. Product Design Guardian is **NOT_APPLICABLE** for this qualification branch with explicit rationale. When the corresponding web/mobile screens are redesigned or introduced, Figma + Carbon/PatternFly/Radix/browser evidence becomes mandatory.

## Regulatory Knowledge Gate

These Sprints implement field-force operational workflows and do not encode a pharmacovigilance regulatory decision. Regulatory Knowledge Gate is **NOT_APPLICABLE** with reviewer-approved rationale.

## Qualification blockers

Wave 2 must not be called COMPLETE until:
- foundation CI passes;
- mobile regression passes;
- migrations apply and roll back successfully;
- Wave 1 and Wave 2 boundary SQL both pass;
- CodeRabbit has zero unresolved material findings;
- evidence manifests are updated with real CI/review evidence;
- product-gate verifier passes.
