# Sprint 23 — Security + Audit Hardening

## Requirement IDs
- TRV-SEC-001: Every API response shall carry a bounded correlation identifier and production security headers.
- TRV-SEC-002: JSON request parsing shall enforce configured byte limits even when Content-Length is missing or untrusted.
- TRV-SEC-003: Security and critical field-work state changes shall create append-only database audit evidence.
- TRV-SEC-004: Audit evidence shall retain tenant, actor when available, table, record, operation, timestamp, and before/after row state.
- TRV-SEC-005: Application roles shall not update or delete audit evidence.
- TRV-SEC-006: Audit capture shall not weaken existing RLS, permissions, idempotency, GPS, or tenant boundaries.
- TRV-SEC-007: Security hardening shall not add client-visible secrets, provider details, or mutable security state.

## Scope Lock
- Responsible area: API boundary security and immutable database audit evidence.
- Allowed paths: `modules/security/**`, `apps/api/src/**`, `apps/api/test/security.test.ts`, `database/migrations/0023_security_audit*.sql`, `docs/requirements/sprint-23-security-audit.md`, `tsconfig.json`.
- Forbidden paths: domain business rules, offline replay semantics, analytics formulas, UI workflows.
- Database change: additive audit table/function/triggers only.
- API contract change: additive response headers only.

## Four-principle gate
- Karpathy: central controls, no endpoint-by-endpoint rewrite.
- Ponytail: one reusable boundary module and one generic database trigger.
- Warpath: fail closed on oversized/malformed bodies; audit table is append-only and not client-readable.
- CodeRabbit: external review required before merge.

## Rollback
Apply `0023_security_audit.down.sql` and revert the Sprint 23 API boundary commits. No business records are modified by rollback.
