# Sprint 2 — Organisation Hierarchy + RBAC

Status: Implementation

## Requirements

- **TRV-ORG-001** — A tenant shall support company → division → zone → region → area → territory.
- **TRV-ORG-002** — Organization codes shall be unique inside a tenant.
- **TRV-ORG-003** — A user may be assigned to organization units, with at most one active primary assignment.
- **TRV-ORG-004** — Cross-tenant organization relationships shall be rejected by database constraints.
- **TRV-RBAC-001** — Terrevo shall provide standard roles TENANT_ADMIN, MANAGER and MR.
- **TRV-RBAC-002** — Permissions shall be evaluated server-side within authenticated tenant and organization scope.
- **TRV-RBAC-003** — TENANT_ADMIN is tenant-wide; MANAGER and MR require organization scope.
- **TRV-RBAC-004** — Supplying another organization or tenant identifier shall never grant access.
- **TRV-RBAC-005** — Organization/RBAC writes shall use server-only privileged credentials only after permission checks succeed.

## Deliberate simplification

Terrevo v1 uses standard roles rather than a custom role-builder. Manager coverage is determined by the organization-unit scope. Custom roles can be introduced later when a real client requirement justifies them.
