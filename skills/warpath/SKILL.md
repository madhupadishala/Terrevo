---
name: warpath
description: Terrevo-local adversarial pre-merge and pre-deploy gate for blast radius, failure modes, security, rollback and field reliability.
---
# Warpath
This is a Terrevo-local skill, not a claimed third-party canonical package.

Before merge/deploy, attack the change:
1. What existing behavior can break?
2. Can tenant data cross boundaries?
3. Can retry/reconnect create duplicates?
4. Can clock/GPS/network failure corrupt state?
5. Can a partial migration leave mixed versions?
6. Can previous mobile clients still call the API?
7. Can accidental repeat actions cause damage?
8. Is failure observable?
9. Can rollback occur without data loss?
10. Is there a smoke test?
11. Did unrelated UI/module changes enter the diff?
12. Are secrets or privileged credentials exposed?

HOLD for cross-tenant exposure, data loss/corruption, duplicate critical records, missing server authorization,
breaking API without migration strategy, irreversible unsafe migration, missing rollback for risky release,
critical regression or unexplained scope expansion.

Output:
WARPATH: GO or HOLD
Blast radius:
Failure modes tested:
Rollback:
Blocking findings:
Residual risks:
