# Terrevo — Parallel Development Contract v1
**Date:** 2026-10-11
**Owner:** Chat 1 (Core Engineering). **Delegation controller:** Chat 2.
**Repository:** `madhupadishala/Terrevo`
**Canonical in-progress integration branch:** `feature/ui-live-role-workspaces` (PR #50)
**Production branch:** `main` (only Chat 1 may propose/promote integration; do not deploy without validation).

## Product constraints
- Build original Terrevo product experiences using IBM Carbon (`@carbon/react`) and existing Next? **Actual web stack is React/Vite, NOT Next.js**. Keep existing stack.
- Use the 84-page Cadila/Niti Salesforce guide only for field names, workflow requirements and coverage. Never copy proprietary artwork, layouts, icons, copy, logos or images.
- No fake persisted data, GPS observations, HCP/doctor records, approved promotional content, simulated AI decisions, fabricated working network APIs or provider secrets.
- Preserve tenant separation, existing RBAC, current server security, audit and explicit authorization.
- NO Super Admin email, user bootstrap or shared platform credential.
- Read existing repo/branch before generating code. **Do not overwrite any existing implementation**.
- Common UI and routing integration is performed by Chat 1 only. Chat 2 packages self-contained components and tests, with props-only interfaces for unavailable APIs.

## Exclusive file ownership / staging branches

| Package | Branch | Chat 2 may change |
|---|---|---|
| A Customer 360 | `feature/terrevo-ui-customer360` | `apps/web/src/features/customer360/**`, `apps/web/test/customer360*.test.*`, package-specific README |
| B NCA/unplanned | `feature/terrevo-ui-activities` | `apps/web/src/features/activities/**`, `apps/web/test/activities*.test.*`, package-specific README |
| C E-detailing/CLM | `feature/terrevo-ui-edetailing` | `apps/web/src/features/edetailing/**`, `apps/web/test/edetailing*.test.*`, package-specific README |
| D Today/AI briefing | `feature/terrevo-ui-intelligence` | `apps/web/src/features/intelligence/**`, `apps/web/test/intelligence*.test.*`, package-specific README |

Chat 2 MUST NOT edit: `apps/api/**`, `database/**`, `modules/**`, `apps/web/src/App.tsx`, `apps/web/src/terrevo-api.ts`, `apps/web/src/MonthlyPlanner.tsx`, `apps/web/src/BusinessWorkspace.tsx`, `apps/web/src/PlatformConsole.tsx`, `apps/web/src/styles.scss`, `apps/mobile/**`, `package.json`, any configuration, shared test infrastructure or `main`. Any cross-boundary suggestion goes in `INTEGRATION_REQUEST.md` inside the owned feature folder, not in an unauthorized code edit.

## Existing API contracts (verify on branch; do not make up endpoints)
- `TerrevoWebApi` in `apps/web/src/terrevo-api.ts`: `masters(kind)`, `plans()`, `getPlan(id)`, `startOptions()`, `progress()`, `openVisit()`, `dcrs()`, `rcpa(visitId)`, `order(visitId)`, `inventory()`, `manager()`, `analytics()`, `orgUnits()`.
- Authorized business endpoints run at **`/api/v1/...`** through this client. Never call `/v1/...` from the browser, use unauthenticated network writes, or connect directly to the Supabase service-role API.
- Existing weekly plan status is `DRAFT|SUBMITTED|APPROVED|REJECTED|RETURNED`. NCA, relationship-linking, e-detailing content/session recording and AI suggestion writes are **NOT verified as supported API contracts**. Implement UI + typed props and documented integration requirements; do not label these features live.
- New global platform Super Admin backend is owned by Chat 1. DO NOT alter it.

## Four delegation assignments — issue all four upfront

### A — Customer 360
Create `Customer360View` using Carbon React. Users can search/filter existing authorized doctors, chemists and stockists by customer type/name/territory; select a customer and view identity, master fields, missing/available information, linked outlets where **actual relationship data is passed via props**, activity history where passed via props, and navigational/action hooks for existing field workflows. Empty/error/loading states, keyboard navigation, responsive UI. No invented relationships, call history, contact details or API. Props must accept existing `Master`-shaped authorized records and optionally explicit history/links provided by Chat 1. Tests: search, role/tenant change clears selection, empty state, missing links and no unauthorized mutations.

### B — NCA & unplanned field activity
Create `ActivitiesView` with distinct `PLANNED_CALL`, `UNPLANNED_CALL`, `NON_CALL_ACTIVITY` paths, specific activity subtype, dates, selected territory, known customer (for unplanned calls), reason, duration, remarks, evidence/attachment metadata representation, and review/confirmation screens. Explicitly label draft-only until a server NCA/unplanned contract is provided. Strong field validation and no ability to submit as a doctor call. Typed output `ActivityDraft`; controlled callback `onSaveDraft` only when available; no hidden network requests. Tests: conditional fields, error states, draft validation, clearing records across tenant changes.

### C — E-detailing / CLM
Create `EDetailingView` with approved-content library, product/category filters, selected content preview, keyboard-accessible slide navigation, time-on-slide engagement tracking **only in UI memory**, session review. Accept authorized `ApprovedAsset[]` from props; when none, show no approved content; do not add demo promotional or medical materials and do not automatically upload/record a session. Add typed `DetailingSessionDraft` and optional callback for a future backend. Prevent claims that the session was persisted. Tests: empty assets, unapproved content excluded, bounded navigation, no automatic report submission.

### D — Today workspace and AI briefing
Create `TodayIntelligenceView` using existing authorized `Progress`, `StartOption`, and explicit `ManagerCommand` props. Show next actions, planned visit status, pending work and relevant insights derived **deterministically** from real data. Optional `AiSuggestion[]` interface with citation/evidence, confidence/uncertainty, action type, tenant/source metadata, and explicit human confirmation. AI suggestions absent by default; do not fabricate or call an unapproved model API. Tests: no hallucinated suggestions, stale/empty record handling, per-tenant reset and no autonomous mutations.

## Source deliverable, QA, handoff
Every package must deliver:
1. Own feature files and component exports, types/interfaces, README.
2. `tests` using current repository dependencies only (no new dependencies without Chat 1 approval).
3. `INTEGRATION_REQUEST.md` listing input props and callbacks, missing API contracts, supported vs unsupported functionality, screenshot/UX considerations, security and accessibility observations.
4. `FILE_MANIFEST.txt`: every created/changed file and reason, no unowned file changes.
5. Build/test evidence: `npm run build:web`, `npm run test:web` where relevant. Existing CI/Playwright tests must not regress.
6. If external LLM delivers ZIP: unpack in isolation; inspect contents and files, reject secrets, binaries, unapproved dependencies, altered paths and mass rewrites; compare against pinned baseline; import individual files only; test before commit.
7. Commit each package to its exclusive staging branch and open an independent PR against the common integration branch, not `main`. Chat 1 alone handles the final shared `App.tsx` integration after review.

## Two-hour checkpoint targets
- 0–20m: Chat 2 reads this contract and the code, authors/distributes four prompts upfront, records task/LLM owners.
- 20–60m: Receive deliveries, check source tree, normalize types and fix local compile issues. Mark unfinished tasks blocked; do not fabricate success.
- 60–100m: Create per-package PRs with CI and manifests, ask for missing contract decisions from Chat 1.
- 100–120m: Handoff accepted PR refs, exact commit SHA, tests and remaining dependencies. NO production deployment by Chat 2.

## Non-negotiable acceptance
A screen is not proof of saved data; a mocked test is not live DB qualification; a ZIP is not an integrated release; an AI placeholder is not a qualified agent. Clearly distinguish code-complete, interface-ready, API-integrated, clinically/commercially reviewed and production-qualified.

## Handoff format
```
Task / Package:
Branch and PR:
Commit SHA:
Owned files added/modified:
Public component exports and props:
Routes consumed (verified):
Tests and evidence:
Remaining API/backend dependencies:
Security / tenant / privacy issues:
Ready for Chat 1 integration? YES / NO
```
