# Sprint 1 — Identity + Tenant

Status: Implementation

## Requirements

- **TRV-ID-001** — Terrevo shall authenticate a user through the configured identity provider without storing the user's password.
- **TRV-ID-002** — Protected API operations shall require a valid bearer access token.
- **TRV-ID-003** — Terrevo shall support logout through the configured identity provider.
- **TRV-ID-004** — Terrevo shall support password-reset initiation through the configured identity provider.
- **TRV-TENANT-001** — An authenticated user shall see only active tenants available through an active membership.
- **TRV-TENANT-002** — A tenant-scoped request shall be rejected unless the authenticated user has active access to the requested active tenant.
- **TRV-TENANT-003** — Database row-level security shall prevent authenticated users from reading tenants outside their active memberships.
- **TRV-TENANT-004** — Normal authenticated users shall not create, update or delete tenants or tenant memberships.

## Deferred intentionally

Organization hierarchy, roles and permissions are Sprint 2. User provisioning/admin UX is not part of this sprint.
