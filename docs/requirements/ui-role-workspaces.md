# Terrevo — role-aware web functionality integration

## Delivery scope
This change replaces the Wave 1 browser-local workspace with API-connected role-aware web workspaces. It does not require a Super Admin email address or platform account provisioning.

## Available interfaces
- Field execution: approved tour options, live progress, GPS-gated tour start, planned visit check-in/out, doctor/trade call outcomes, tour submission.
- Tour planning: create single-stop weekly plans from authorized territory and master data, submit saved drafts.
- Manager: authorized command-center metrics, seven-day analytics, pending tour approval and return actions.
- Organization administrator: organization hierarchy listing/creation, master lists and role assignment for existing user IDs.
- Platform Super Admin: separate UI entry and explicit acknowledgement that a global server-authorized platform role/API does not exist yet. This UI **must not** imply platform privileges, show cross-tenant data, or reuse TENANT_ADMIN as a global role.

## Verified backend contracts used
All calls use `/api/v1/*`, not the broken root `/v1/*` path. Existing Supabase-issued access tokens and active `X-Tenant-Id` header are required for all business reads and writes. The browser never receives the Supabase secret key or a shared server-side privileged token.

## No invented user/company data
No business records are fabricated. On disconnected or empty states, metrics use `—`, and worklists show empty states. Frontend geolocation must come directly from user-granted device GPS. No GPS mocks are used in the application. Browser tests use strictly isolated route fixtures.

## Security boundary
The existing authentication contract remains in place. An existing account can be connected through a temporary in-memory web session for integration testing; no user accounts are created or credentials saved to browser storage. Real Supabase RLS and roles still control every mutation. The platform SUPER_ADMIN model, its data migrations, server authorization, bootstrap and platform audit require a separately qualified backend change.

## Acceptance
1. No legacy browser-local tour writes.
2. Workspaces are navigable without fake business data.
3. Connected field and manager actions use actual backend route and permission contracts.
4. Unauthenticated operations cannot submit mutations.
5. Tests cover browser navigation, API paths, tenant headers, and representative field and manager scenarios.
6. Exact-head CI, CodeRabbit and release gates pass before production promotion.
7. Actual Supabase integration testing with an authorized account remains a separate gate, not supplied by mocked Playwright fixtures.
