# Wave 3 Requalification — Sprints 11–15

Status: **IMPLEMENTED / NOT QUALIFIED**

Baseline: CodeRabbit-approved Wave 2 branch. Earlier waves are not modified.

Wave 3 requalifies the existing production runtime for Submit Tour, Daily Timesheet, Weekly Timesheet, Chemist/Stockist Calls, and RCPA.

The database qualification creates two independent tenants and verifies short-day submission, submit/review idempotency, automatic daily timesheet generation, weekly self-approval prevention and manager scope, mandatory trade-call-before-checkout behavior, trade/RCPA payload replay protection, foreign visit/product rejection, direct-write denial, service-RPC denial to authenticated clients, and cross-tenant RLS invisibility.

Implementation is not completion. Wave 3 remains **IMPLEMENTED / NOT QUALIFIED** until exact-head CI is green, CodeRabbit has no unresolved material findings, evidence is bound to the reviewed implementation SHA, and Product Gates succeeds.
