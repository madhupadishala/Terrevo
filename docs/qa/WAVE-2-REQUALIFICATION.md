# Wave 2 Requalification — Sprints 6–10

Status: **IMPLEMENTED / NOT QUALIFIED**

Baseline: current governance branch. Wave 1 is treated as closed and is not modified by this branch.

## Scope

Wave 2 requalifies the already-implemented runtime behavior for:

1. Sprint 6 — Start My Tour
2. Sprint 7 — Show My Tour
3. Sprint 8 — GPS Check-in / Check-out
4. Sprint 9 — Doctor Call + Automatic DCR
5. Sprint 10 — Samples + Gifts

The runtime modules and migrations already exist. This branch adds qualification evidence and abuse-path verification without rewriting proven production behavior.

## Qualification coverage

- Sprint 6: one ACTIVE execution, operation idempotency, tenant-local date and trusted start semantics.
- Sprint 7: active-tour read projection, elapsed/remaining time, ordered stop state, null when inactive.
- Sprint 8: geofence/accuracy outcomes, exception reason, single open visit, idempotent visit operations, no self-review.
- Sprint 9: doctor-call validation, product uniqueness/division scope, idempotent save, DCR creation/snapshot rules.
- Sprint 10: scoped issue/return/distribution, non-negative balance, immutable ledger, idempotency, DCR distribution snapshot.

## Security and tenant boundary

`database/ci/wave-2-boundary-tests.sql` creates two independent tenants and verifies:

- Tenant A can read its own execution, visit and inventory fixtures.
- Tenant A cannot read Tenant B execution, visit or inventory rows.
- `authenticated` has no INSERT/UPDATE/DELETE grants on governed Wave 2 state tables.
- `authenticated` cannot execute service-only mutation entrypoints.
- a second ACTIVE execution is rejected;
- GPS exception self-review is rejected;
- inventory replay is idempotent;
- payload-mismatched replay is rejected;
- over-return is rejected;
- inventory never becomes negative.

## Existing regression evidence

Repository CI continues to run foundation/API tests, mobile tests, migrations forward/reverse, architecture/dependency checks, secret scanning, dependency audit and build verification. Existing Sprint 6–10 API/module tests remain part of the foundation regression suite.

## Qualification rule

Implementation is not completion. Wave 2 remains **IMPLEMENTED / NOT QUALIFIED** until the exact implementation commit has green CI, a clean independent CodeRabbit review, evidence is bound to that exact commit, and Product Gates succeeds.
