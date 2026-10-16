# SECURITY DEFINER EXPOSURE REVIEW — PILOT/UAT GATE

Status: reviewed for pilot/UAT transition.

## Why authenticated SECURITY DEFINER helpers still exist

Terrevo deliberately keeps a small set of read/helper functions callable by the `authenticated` role because they are part of server-approved read paths used to resolve tenant/organization scope, derive manager/team projections, and expose user-scoped tour/attendance state. They are not general administrative mutation surfaces.

The allowed group currently includes:

- `can_access_tour_plan(uuid,uuid,text)`
- `can_read_field_visit(uuid,uuid)`
- `employee_division(uuid,uuid)`
- `has_master_access(uuid,uuid)`
- `has_permission(uuid,text,uuid)`
- `inventory_item_division(uuid,text,uuid,boolean)`
- `manager_analytics(uuid,integer)`
- `manager_command_center(uuid)`
- `my_active_tour_progress(uuid)`
- `my_attendance(uuid)`
- `my_start_tour_options(uuid)`
- `org_unit_in_scope(uuid,uuid,uuid)`
- `user_has_permission(uuid,uuid,text,uuid)`
- `user_has_plan_permission(uuid,uuid,uuid,text)`

These functions remain `SECURITY DEFINER` only where elevated visibility is required to evaluate scope safely across protected rows. Their callers do not gain arbitrary table access; the functions themselves perform tenant/user/scope checks.

## Exposure controls

The pilot gate requires all of the following:

1. `anon` must have no EXECUTE privilege on any public SECURITY DEFINER function.
2. `authenticated` must have no EXECUTE privilege on any `admin_%` mutation RPC.
3. Only explicitly required business-read helpers may remain executable by `authenticated`.
4. Service-role mutation RPCs remain callable only by the server-side service role.
5. Every authenticated-callable SECURITY DEFINER function must have a pinned search path:
   - preferred: `search_path=""` with fully-qualified object references, or
   - `search_path=pg_catalog` only for functions that intentionally require catalog-only resolution.
6. Any newly introduced authenticated-callable SECURITY DEFINER function without a pinned search path is a CI-breaking defect.

## Search-path verification

Production catalog review confirmed all currently authenticated-callable SECURITY DEFINER helpers have `search_path=""`.

This prevents malicious or accidental object shadowing through caller-controlled or mutable schemas and removes schema-hijacking ambiguity from function name resolution.

## Automated regression coverage

`database/ci/public-definer-privileges-tests.sql` now asserts:

- zero anonymous-callable SECURITY DEFINER functions;
- zero authenticated-callable `admin_%` SECURITY DEFINER mutation functions;
- required authenticated business-read helper privileges remain present;
- required service-role mutation privileges remain present;
- every authenticated-callable SECURITY DEFINER helper is pinned to either `search_path=""` or `search_path=pg_catalog`.

The database CI job runs this check after all forward migrations and before rollback qualification.

## UAT change control

`docs/TERREVO_FUNCTIONAL_SCOPE_FREEZE.md` remains the accepted product baseline. During pilot/UAT:

- behavior changes that diverge from the frozen matrix are breaking defects;
- they are not to be treated as convenience changes or iterative UX adjustments;
- remediation must preserve the accepted provider contracts unless the scope freeze is explicitly re-baselined.
