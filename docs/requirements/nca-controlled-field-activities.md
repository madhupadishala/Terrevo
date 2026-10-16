# Terrevo controlled Non-Call Activity (NCA) contract — Chat 1

## Scope and reference
The 84-page Cadila / Niti-SFA end-user guide describes NCA planning with type and town (pp.17–19) and NCA reporting with reason and remarks (pp.29–34). Terrevo uses distinct NCA records, not a synthetic doctor visit or DCR.

**Implementation state:** Source, migration, and tests are in `feature/ui-live-role-workspaces` / PR #50. The migration has not been verified on production Supabase; no live user qualification or deployment is claimed.

## REST endpoints (browser prefix `/api/v1`, internal prefix `/v1`)
All endpoints except health/auth require a verified bearer and the active `x-tenant-id` header, resolved by `resolveTenantRequest`.
- `GET /v1/nca/options`: `{options:{categories:[{code,label,active}],towns:[{id,name,territoryId,active}]}}` with towns filtered to authorized territories; no fabricated categories.
- `GET /v1/nca/own`: `{records:NcaRecord[]}`, most recent 200 own rows, tenant-scoped.
- `POST /v1/nca`: `{operationId:UUID,workDate:YYYY-MM-DD,territoryId:UUID,phase:"PLAN"|"REPORT",categoryCode:string,townId:UUID|null,reason:string,remarks:string,durationMinutes:number}` → 201 `{record}` in DRAFT state. Never submits a doctor call.
- `POST /v1/nca/{recordId}/submit`: 200 `{record}` with SUBMITTED state. Requires original owner and currently authorized territory.
- `POST /v1/nca/categories`: `{code,label}` → controlled tenant category creation/reactivation. Requires `MASTER_MANAGE`.
- `POST /v1/nca/towns`: `{territoryId,name}` → controlled town belonging to an active territory. Requires `MASTER_MANAGE`.

The client methods are `TerrevoWebApi.ncaOptions`, `ownNcaRecords`, `saveNcaDraft`, `submitNca`, `configureNcaCategory`, and `configureNcaTown`.

## Validation and governance
- Only approved active NCA categories are accepted; town must be part of the selected tenant and territory.
- PLAN requires a verified town. REPORT requires actual remarks as well as a reason.
- Work date is checked as a calendar date in UTC to avoid local time zone shifts.
- Duration is an integer between 1 and 1440 minutes. Reasons have a 500-character bound and remarks a 2000-character bound.
- `TOUR_PLAN_OWN` permission, active employee assignment, organization scope, and tenant membership are verified before mutating.
- PostgREST mutations run through service-role-only PostgreSQL functions; direct table writes by `anon` and `authenticated` are revoked. Tables use RLS.
- `operationId` is a per-actor, tenant-scoped idempotency key for draft creation. Never reuse it for a new draft.
- NCA is **not** an attendance, GPS, e-detailing, unplanned customer call, or medical promotional evidence API.
- Client-provided evidence references are not accepted as uploads; the application rejects such handoffs.

## Browser integration
`ActivitiesView` receives categories/towns from the server. Only `NON_CALL_ACTIVITY` may call `saveNcaDraft`; other kinds remain non-persisted until their distinct backend contracts exist. The My NCA list in App provides an explicit submit action. Admins configure controlled categories and towns in Organization Admin.

## Tests and qualification
- `apps/api/test/nca.test.ts`: mandatory fields, authorized scope, controlled categories, town matching, draft state, submit-once and config permissions.
- `apps/web/e2e/nca-flow.spec.ts`: configure category and town → field NCA PLAN draft → submission through API mock fixtures.
- `database/ci/nca-policy-tests.sql`: RLS presence, denial of direct browser writes, service-only RPC grants and no artificial seed data.
- GitHub CI validates forward and rollback migrations and the test suites. **Mock browser tests are not live Supabase UAT**.

## Future increments / release blockers
- Validate a provisioned staging tenant with real employee, territory, category and town assignments.
- Add a controlled catalog management UI for deactivation, with a tamper-evident change audit.
- Integrate optional GPS and attachments only through purpose-built audited contracts.
- Expand to actual unplanned customer calls without treating them as ordinary planned tour stops.
- Verify role scopes and full submission persistence from a real field user and manager, including negative cross-tenant attempts.
