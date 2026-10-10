# Terrevo — Web Business Modules and Global Platform Control Plane

## Implemented in PR #50 (feature/ui-live-role-workspaces)

### Functional workspaces against the existing server APIs
- **Field execution:** Approved tour options, start tour with fresh GPS, visit check-in/out, doctor or trade call outcomes, submit tour.
- **Tour planning:** Server-backed weekly plan, plan submission and manager approval.
- **Trade:** Chemist/stockist RCPA recording and order booking against a live visit.
- **Samples and inventory:** Per-user stock balances, authorized sample/gift distribution and per-visit ledger.
- **Workforce:** Daily and weekly timesheets, attendance, leave requests, expense claims and GPS-assisted joint work.
- **Manager:** Live command-center metrics, analytics, tour approvals, GPS-exception reviews, timesheet/leave/expense decisions.
- **Administration:** Organization hierarchy creation, scope-validated masters, existing-user role assignment.
- **Reports:** Actual DCR worklists from the authorized projection endpoint.

All business activity uses authenticated `/api/v1/*` routes and the current `x-tenant-id` context. The previous browser-local tour engine has been removed. The application never supplies fake business records or grants an unauthenticated write path. Browser tests exercise routes using isolated fixtures, not manufactured records in the runtime app.

### Separate platform Super Admin control plane
- New `platform_admin_grants` database table starts **empty**, without a default identity or email.
- PostgreSQL RLS and REVOKE block ordinary authenticated/anonymous users from grants and audit.
- Platform-only endpoints: `GET /v1/platform/context`, `GET|POST /v1/platform/tenants`, `PATCH /v1/platform/tenants/:id/status`, `GET /v1/platform/audit`.
- The server authenticates bearer tokens via Supabase before checking the platform grant. Tenant-admin RBAC does not confer platform authority.
- Database RPCs for tenant creation and activation changes enforce the grant and write the audit record atomically in the same transaction.
- Platform console displays genuine platform tenants and audit records only for an authorized identity.

### Automated evidence
- Standard API, TypeScript, web, mobile, database migration and rollback checks.
- PostgreSQL policy qualification: default deny, revoked authenticated execution, authorized mutation, revocation, and audit.
- API negative/positive platform permission tests.
- Chromium: disconnected workflows, authorized field tour with mocked backend API responses, tenant-admin permissions, global platform console navigation and business screen route coverage.

## Explicitly not claimed
- No initial Super Admin identity has been assigned; the control plane remains denied until an existing verified user is securely granted platform access.
- Platform-wide user provisioning, tenant licensing/subscriptions and other global account lifecycle functions still require further backend contracts.
- Actual live Supabase migrations are **not applied** by CI; CI uses disposable PostgreSQL.
- Browser tests with route fixtures do not substitute for an authorized live multi-user, cross-tenant or device-GPS test.
- Server credentials are not exposed to client JavaScript.
- Preview deployment is blocked by Vercel rate limit. Do not promote without an exact-SHA preview, real connected workflows and human UAT.
- Browser-only GPS evidence is not mobile anti-spoofing validation. Presence Integrity qualification remains device-specific.

## Release gates
1. Correct exact-head CI/CodeRabbit findings.
2. Apply and verify migration against the intended staging database, safely and explicitly.
3. Inspect live staging API, role grants, tenant isolation and page rendering.
4. Test full field and manager workflows with authorized accounts, sample data and genuine device coordinates.
5. Run negative privilege escalation and access-control tests, including cross-tenant requests.
6. Review release evidence, then promote after user approval.

This change implements the UI and backend code but is not, by itself, an approved production release.
