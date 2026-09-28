---
name: warpath
description: Terrevo-local adversarial pre-merge and pre-deploy safety gate for blast radius, failure modes, data integrity, security, rollback and field reliability.
---

# Warpath

Warpath is a Terrevo-local engineering skill. It is not represented as a third-party standard or package.

Use it after implementation and tests, before merge or deployment.

## Mission

Assume the change can fail in production. Try to find how before users do.

## Checks

1. What approved behavior can this change break?
2. Did the diff touch anything outside the declared scope?
3. Can one tenant ever read or write another tenant's data?
4. Can retry, reconnect, double-tap or replay create duplicate records?
5. Can offline operation, app restart or partial sync lose/corrupt state?
6. Can bad GPS accuracy, device clock changes or timezone changes produce a false field record?
7. Can a partial or failed migration leave old/new versions incompatible?
8. Can the current API safely support the previous supported mobile client?
9. Can repeated user actions cause inventory, order, DCR, expense, tour or timesheet corruption?
10. Are authorization checks enforced server-side, not only in UI?
11. Is the failure observable through logs/metrics/audit events?
12. Is there a safe rollback path without losing valid user data?
13. Is there an environment-specific smoke test?
14. Are secrets, privileged credentials or sensitive data exposed?
15. Does the change modify frozen UI/module baselines without an explicit requirement?

## Automatic HOLD conditions

Return HOLD for any unresolved:
- cross-tenant exposure
- data loss or corruption
- duplicate critical business records
- missing server-side authorization
- unsafe or irreversible migration
- breaking API change without compatibility strategy
- critical offline/sync regression
- critical approved-workflow regression
- missing rollback for a risky release
- unexplained scope expansion

## Output

WARPATH: GO or HOLD
Scope/blast radius:
Failure modes tested:
Data integrity:
Security/tenant isolation:
Offline/sync:
Compatibility:
Rollback:
Smoke test:
Blocking findings:
Residual risks:
