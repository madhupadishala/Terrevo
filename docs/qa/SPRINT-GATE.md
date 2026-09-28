# Terrevo Sprint Gate
A sprint is complete only when its capability is demonstrably safe.

Required:
- Requirement IDs mapped
- Scope lock respected
- Acceptance criteria verified
- Typecheck/lint/unit/integration/relevant E2E
- Offline/GPS tests when applicable
- Tenant/security checks when applicable
- Visual regression when UI is involved
- Ponytail PASS
- Warpath GO
- CodeRabbit completed when available
- No release-blocking defect
- Rollback considered

Release blockers include cross-tenant exposure, data loss, duplicate orders/samples/tours, broken auth,
corrupt migrations, critical offline-sync failure or regression of an approved P0 workflow.
