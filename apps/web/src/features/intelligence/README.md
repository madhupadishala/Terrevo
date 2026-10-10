# Today & AI-ready briefing
Pure deterministic summary built only from verified Progress, StartOption and ManagerCommand types. AI suggestions are optional, absent by default, tenant scoped and must include provenance + uncertainty; no model inference or automatic action. Parent must pass authorizedForTenantId and contextKey; stale data is suppressed. Not live-integrated until Chat 1 routes the component. Guide field-by-field reconciliation pending.
Checks to execute in an environment with dependencies: npm run typecheck:web; npm run build:web; npm run test:web. Not yet run.

## Guide verification (84-page Salesforce / Niti-SFA guide)
Guide pp. 23–28 links approved planning, Start My Day and Agenda. This package computes deterministic current-day metrics from actual Progress and StartOption only; real daily agenda and authorization remain Chat 1 shell/backend integration.

## Initial CI evidence (before latest workflow alignment)
GitHub CI #461 foundation PASSED: npm run verify:foundation, npm run typecheck, npm test (93/93), npm run test:web (12/12), npm run build, git diff --check. Database and mobile checks also passed. Follow-up PR CI must qualify the current commit. No production deployment.
