# Sprints 1–10 Four-Layer Revalidation

Status: ACTIVE

This audit revalidates the already-merged Terrevo baseline. It does not rewrite working code by default. A code change is allowed only when a concrete finding is identified.

## Review order

For each sprint:

1. Karpathy — assumptions, scope, simplicity, verifiable success criteria.
2. Ponytail — delete/stdlib/native/YAGNI/shrink review.
3. Warpath — tenant leakage, data integrity, idempotency, concurrency, time/GPS failure, compatibility, rollback, observability.
4. CodeRabbit — independent external PR review.
5. CI — TypeScript/tests/diff plus full forward and reverse database migration chain.

## Exit rule

A sprint is REVALIDATED only when:
- its current requirements are traceable to code/tests;
- no blocking Karpathy/Ponytail/Warpath finding remains;
- CodeRabbit has either posted a completed review or is explicitly recorded as externally unavailable;
- all relevant automated gates pass;
- any required correction is merged before moving the sprint to REVALIDATED.

## Sprint matrix

| Sprint | Capability | Karpathy | Ponytail | Warpath | CodeRabbit | CI | Result |
|---|---|---|---|---|---|---|---|
| 1 | Identity + Tenant | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 2 | Organisation + RBAC | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 3 | Core Masters | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 4 | Tour Planning | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 5 | Tour Approval | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 6 | Start My Tour | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 7 | Show My Tour | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 8 | GPS Check-in / Check-out | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 9 | Doctor Call + DCR | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 10 | Samples + Gifts | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## Scope lock

- Requirement: TRV-AUDIT-001
- Responsible area: engineering governance / previously merged Sprints 1–10
- Allowed initially: docs/reviews/** only
- Product code changes: only after an explicit finding expands scope
- UI CHANGE: NO
- DATABASE CHANGE: NO initially
- API CONTRACT CHANGE: NO initially
- SECURITY/TENANT IMPACT: review only initially
- OFFLINE/SYNC IMPACT: review only initially
