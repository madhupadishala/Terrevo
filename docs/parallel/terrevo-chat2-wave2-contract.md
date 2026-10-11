# Terrevo — Chat 2 Wave 2 delegation contract

**Status:** Assignments created; Chat 2 must explicitly begin execution. This document is not evidence that its packages have been built.

## Authority and baseline
- Core integration/release owner: **Chat 1**.
- Repository: `madhupadishala/Terrevo`.
- PR base: `feature/ui-live-role-workspaces`, PR #50.
- **Pinned common starting commit for all four feature branches:** `2e5d9ee310ceb5287d0d1c52d3e8c9974af927d4`.
- Required quality: IBM Carbon + existing React/Vite TypeScript; no hard-coded clinical/business fixtures in runtime UI.
- Manual Vercel releases only; `vercel.json` has `git.deploymentEnabled=false`. Never deploy Chat 2 branches.
- Read `docs/parallel/terrevo-chat2-contract-v1.md` and each assignment issue before code.

## Four independent work packages

| Issue | Starting branch | Exclusive working files | Acceptance |
|---|---|---|---|
| [#55](https://github.com/madhupadishala/Terrevo/issues/55) | `feature/terrevo-s09-customer-relations-ui` | `apps/web/src/features/customer-relations/**`, `apps/web/test/customer-relations*.test.ts` | Tenant/subject-scoped relationship/history UI with chronological evidence, accessible filtering, no invented links |
| [#56](https://github.com/madhupadishala/Terrevo/issues/56) | `feature/terrevo-s11-clm-library-ui` | `apps/web/src/features/clm-library/**`, `apps/web/test/clm-library*.test.ts` | Approved/expired/revoked product-region content library with documented session handoff, no fabricated assets |
| [#57](https://github.com/madhupadishala/Terrevo/issues/57) | `feature/terrevo-s13-workforce-evidence-ui` | `apps/web/src/features/workforce-evidence/**`, `apps/web/test/workforce-evidence*.test.ts` | Expense/receipt/travel-policy evidence UI with explicit backend gaps, no direct storage writes |
| [#58](https://github.com/madhupadishala/Terrevo/issues/58) | `feature/terrevo-s14-manager-reporting-ui` | `apps/web/src/features/manager-reporting/**`, `apps/web/test/manager-reporting*.test.ts` | Date/territory-scoped KPI and audit report UI that separates planned/unplanned/NCA records and has traceable counts |

## Non-overlap policy
Chat 2 may only change its assigned feature folder and matching scoped tests. Chat 1 exclusively owns:
- `apps/api/**`, `database/**`, `modules/**`
- `apps/web/src/App.tsx`, `terrevo-api.ts`, `BusinessWorkspace.tsx`, `MonthlyPlanner.tsx`, `PlatformConsole.tsx`, `styles.scss`
- Mobile, package versions, global test setup, CI, security, deployment and main.

Do not introduce direct browser `fetch` to unknown routes; do not perform CRUD writes in a UI module without a verified parent callback and server-authorized contract. Tenant/session/context changes must clear privileged state, including async completions. No green badge or "saved" message merely because a callback was dispatched. No fake business data, geofence approval, CLM asset or AI inference.

## Each package must contain
1. `model.ts` — explicitly typed inputs, output intents, authorization and record-scope filtering.
2. One or more React/Carbon views and empty/loading/denied/error states.
3. Pure model tests covering denied scope, stale/cross-tenant data and key edge cases.
4. `README.md` and `INTEGRATION_REQUEST.md` — missing backend read/write contract, expected request/response fields, permissions, evidence/audit design, parent callbacks and nonimplemented parts.
5. File manifest; test command output; PR against integration branch; exact HEAD SHA.

## Review and handoff
- Chat 2 creates **four separate PRs**; no bundling or direct merge. Include `## Scope Lock`, `UI CHANGE`, `DATABASE CHANGE`, `API CONTRACT CHANGE` sections per repo template (state false for latter two).
- Chat 1 checks PR file scope, TypeScript/tests/CI, tenant and role isolation, stale callbacks, human review, feature semantics and never invents server integration.
- After acceptance Chat 1 wires only authorized data sources and records unresolved backend work in the release tracker [#59](https://github.com/madhupadishala/Terrevo/issues/59).
- A "done" claim requires issue, PR, SHA, test evidence and explicit backend gaps; **merged UI is not production-qualified end-to-end functionality**.

## Chat 1 concurrent work
Chat 1 owns [S01–S06 release gates](https://github.com/madhupadishala/Terrevo/issues/59): PR #50 reconciliation, local preflight, isolated staging, role + live session UAT, network/GPS/regression qualification, exact-SHA manual production release. Chat 2 must not block those gates or silently change core interfaces.
