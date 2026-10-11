# Terrevo — Planned and Unplanned Field Calls (Chat 1 integration contract)

**Branch:** `feature/ui-live-role-workspaces`, PR #50. **Release state:** CI integration candidate, not promoted to production.

## Distinct business processes
**Planned:** Existing approved weekly/monthly tour-plan stop → start approved tour → device-GPS check-in → doctor or chemist/stockist call capture → check-out → DCR/trade report → manager tour monitoring. No duplicate or substitute planned-call record is created. On the Activities screen, **Open approved planned stop** navigates to the original server-authorized stop, with no synthetic transaction.

**Unplanned:** During an *active assigned tour* and after any other checked-in visit has closed, a representative chooses an active customer from the authorized territory, documents the unplanned reason/remarks and duration, explicitly grants device GPS, and submits a distinct unplanned call for manager review. It does **not** masquerade as a planned stop, a completed DCR, a geofence-verified visit or an approved interaction. The captured location is evidence, not proof of customer presence.

## APIs
All use bearer authentication and the authorized `x-tenant-id` context; browser prefix `/api/v1`.
- `GET /v1/unplanned-calls/own` → `{calls:UnplannedCall[]}`
- `POST /v1/unplanned-calls` → `201 {call}`, with `{operationId,executionId,territoryId,customerType:"doctor"|"chemist"|"stockist",customerId,reason,remarks,durationMinutes,latitude,longitude,accuracyMeters}`.
- `GET /v1/unplanned-approvals` → `{calls:UnplannedCall[]}`, visible pending calls filtered through territory manager authorization.
- `POST /v1/unplanned-approvals/:id/decision` → `200 {call}` with `{decision:"APPROVE"|"REJECT",comment}`; comment mandatory for rejection.

Records move from `SUBMITTED` to `APPROVED` or `REJECTED` once; only manager roles with `TOUR_APPROVE` in scope may decide. The representative cannot self-approve. Decisions are persisted in `unplanned_call_decisions`. Neither a representative nor manager can directly write to these tables via an authenticated Supabase table API.

## Database and validation
Migration: `database/migrations/9997_unplanned_call_review.sql`. Rollback: `9997_unplanned_call_review.down.sql`.

Create RPC validates active tenant membership, active employee, `TOUR_PLAN_OWN` scope, active tour ownership, territory, absence of another checked-in visit, and active customer of the correct type and territory. It validates operation IDs, reason, remarks, integer duration and finite GPS bounds. Unique (tenant, actor, operation) enforces replay safety and blocks conflicting reuse. The manager decision RPC checks separate reviewer identity, territory permission and current SUBMITTED state. RLS separates owner and manager visibility and denies outsiders.

## Verification achieved in CI (not live Supabase UAT)
- Domain tests: `apps/api/test/unplanned-calls.test.ts`.
- Browser tests: `apps/web/e2e/planned-unplanned-flow.spec.ts`, with authorized records and mocked API requests.
- PostgreSQL migration and rollback tests: GitHub Actions `database-migrations` job.
- SQL integration: `database/ci/unplanned-call-integration-tests.sql` creates fixture tenant, hierarchy, staff, active tour and doctor in a **rollback transaction**, executes the **real PostgreSQL** create/replay/review procedures and verifies outsider, self-approval, cross-tenant and RLS denial under authenticated role/JWT claims.
- SQL security: `database/ci/unplanned-call-policy-tests.sql`.

## Remaining production-release gates
1. Link a staging Supabase instance or connect Supabase inside ChatGPT; verify migration history, run the migration on staging and check actual login and persistence using separate MR/manager identities.
2. Confirm Vercel preview environment has **staging** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Current canonical Vercel project has these configured for production only. Do not copy production secrets to untrusted previews.
3. Perform real-device geolocation, interrupted-network retry, manager approval, cross-tenant denial and refresh/relogin tests with staging data.
4. Confirm CodeRabbit, CI, Preview READY at **the exact candidate commit**, and owner approval. Then migrate the intended production Supabase database, promote the verified integration through PR #50, and check the production URL with authorized users.
5. For guide-level parity, add evidence upload, verified geofence validation and an independently approved DCR treatment for unplanned calls; they are **not** provided by this independent ledger.

**Do not describe preview build readiness or mocked browser tests as proof of successful live Supabase writes.**
