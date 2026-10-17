# Terrevo V3.2 — S01 consolidation and canonical baseline

Status: **IN PROGRESS**. This is a repository evidence record, not a declaration of merged or production-qualified functionality.

## S01 objective
Consolidate existing Terrevo implementations against one authoritative baseline; preserve Engineer 1/Engineer 2 ownership; reconcile reference fields/contracts; eliminate duplicate or stale work only after comparison; run full CI and regression checks before any merge.

## Canonical source and protected environments
- Integration baseline: `feature/ui-live-role-workspaces` (PR #50). Preserve this until reviewed reconciliation establishes a newer tested integration commit.
- S01 working branch: `feature/terrevo-v32-s01-consolidation`. This branch contains audit/coordination changes only to start.
- Synthetic demo branch: `feature/admin-configuration-staging-fixtures` (PR #66): 8 commits ahead, 0 behind integration at audit; 8 changed files, including `App.tsx`, demo-specific TSX/TS and staging seed. Do not mistake synthetic browser-memory records for API persistence.
- Backend business persistence branch: `feature/terrevo-r04b-business-persistence`: 20 commits ahead, 0 behind integration; modifies `apps/api/src/handler.ts`, business-customer-links service, migrations and qualification tests. Review migrations and replay/rollback before integration.
- Existing production Supabase project is protected; no production writes or deployments in S01.
- Manual Vercel release remains in force; no auto deployments.

## Engineer 2 branches requiring separate reconciliation
All comparisons against `feature/ui-live-role-workspaces` as observed during S01 audit.

| Package | Branch | Ahead | Behind | Canonical proposed destination |
| --- | --- | ---: | ---: | --- |
| Customer relationships (#55) | `feature/terrevo-s09-customer-relations-ui` | 3 | 25 | `apps/web/src/features/customer-relations/` |
| CLM library (#56) | `feature/terrevo-s11-clm-library-ui` | 5 | 25 | `apps/web/src/features/clm-library/` |
| Workforce evidence (#57) | `feature/terrevo-s13-workforce-evidence-ui` | 7 | 25 | `apps/web/src/features/workforce-evidence/` |
| Manager reporting (#58) | `feature/terrevo-s14-manager-reporting-ui` | 6 | 25 | `apps/web/src/features/manager-reporting/` |

These are self-contained feature folders and tests. Review model contracts and integration requests before cherry-picking or merging, and reconcile the 25 behind commits against the current baseline first. Do not overwrite the integration owner's files from feature branches. The branches' existence does not prove that backing endpoints or data persistence are complete.

## Existing verified code structure
- Frontend: React 19, TypeScript, Vite, IBM Carbon, `apps/web/src/App.tsx`. Tabs include Today, Customer 360, NCA, CLM, Field, Tour planning, RCPA/orders, Inventory, Workforce, DCR, Manager, Admin, Platform.
- Backend: `apps/api/src/handler.ts` imports real modules for identity, tenant, RBAC, masters, tour planning/approval/execution, visits, doctor calls, inventory, daily/weekly timesheets, trade calls, RCPA and orders. Route availability != integrated acceptance.
- Project scripts from `package.json`: `npm run verify`, `npm run test:e2e`, `npm run verify:release`, `npm run verify:staging-target`, `npm run test:release-safety`. Tests need to be rerun on the **eventual reconciled SHA**, not inferred from earlier CI.

## Requirements-to-code ownership matrix
| Business area | Primary code area | S01 acceptance evidence required |
| --- | --- | --- |
| Tenant hierarchy, employees, roles, Admin | `modules/organization/`, `modules/masters/`, `modules/rbac/`, `apps/web/src/App.tsx` | CRUD contracts, role checks, hierarchy and audit |
| Planning to tour initiation | `modules/tour-planning/`, `modules/tour-approval/`, `modules/tour-execution/` | Submit/approve/reject/start transitions, conflict checks |
| Doctor, chemist, stockist calls and DCR | `modules/visit-execution/`, `modules/doctor-call/`, `modules/trade-call/`, `apps/api/` | Durable write/read/reload, plan-to-actual reconciliation |
| RCPA, order booking, inventory | `modules/rcpa/`, `modules/orders/`, `modules/inventory/` | Valid references, financial/inventory invariants, audit |
| Customers, CLM, workforce, manager reporting | Engineer 2 isolated features (#55–#58) | Typed UI contract + verified server adapters |
| Offline and GPS | `apps/mobile/`, offline-sync hardening branch | Replay, dedupe, conflicts, permission denial and recovery |
| Agentic AI | Planned shared, versioned AI agent services | Not yet code-verified; no completed-agent claims |
| Validation | `apps/api/test/`, `apps/web/test/`, `scripts/` | Full CI + local end-to-end evidence at integration SHA |

## Known duplicate/deferred risks
1. Earlier feature branches (`feature/terrevo-ui-*`, `feature/txf-*`, Sprint 21–25) exist. Their contents must be compared per file and per contract before choosing a canonical implementation. Do **not** bulk-merge stale branches.
2. `feature/sprint-22-offline-sync-hardening` diverges significantly (22 ahead / 197 behind current integration baseline); should be treated as a source of candidate fixes, not an automatic merge.
3. Reference guide field-level completeness has not been demonstrated in this audit. A signed-off field/validation mapping is needed before claiming functional coverage.
4. Synthetic demo is not integrated API UAT; local development issues (Sass/Vite) require a clean clone install verification.
5. Final identity/UAT is deliberately sequenced late, but server-side tenant scoping/denials are mandatory throughout implementation.

## S01 closure checklist
- [x] Identify canonical integration baseline and document branch comparison.
- [x] Identify owners and non-overlap rules for four delegated UI modules.
- [ ] Inspect older branches and PRs and select per-file canonical implementations.
- [ ] Compare requirement reference fields one by one against UI/API/database.
- [ ] Review and reconcile persistence migrations with existing schema.
- [ ] Rebase or cherry-pick approved feature commits without overlapping writes.
- [ ] Verify clean dependency install, `npm run verify`, Playwright, and release safety on reconciled SHA.
- [ ] Resolve CodeRabbit/reviewer findings and log test/CI evidence.
- [ ] Produce integrated, reviewable PR with no unsupported production-readiness claims.

## Integration order
1. Reconcile backend persistence and migration contracts.
2. Verify already-delivered UI modules independently; port only scoped changes.
3. Wire approved UI adapters through integration-owner code.
4. Carry in demo seed improvements separately, guarding synthetic data from production UI.
5. Run full checks on final SHA; merge only after review and green CI.

**Policy:** no deployment, billing, secret changes, production database writes or automatic merge in S01.
