# Wave 1 Architecture Assessment

Reviewed: 2026-10-02  
Scope: Sprints 1–5 — Identity/Tenant, Organization/RBAC, Core Masters, Tour Planning, Tour Approval.

## Conclusion

**PASS for the Wave 1 architecture gate, subject to the normal exact-commit CI and CodeRabbit qualification.**

The review found explicit domain boundaries, one infrastructure composition boundary, shared authorization services injected through contracts, and no Supabase/Vercel dependency imported into Wave 1 domain modules.

## Boundary review

The API composition root is `apps/api/src/handler.ts`. It imports the Wave 1 domain services from `modules/**` and creates one provider adapter through `apps/api/src/supabase-adapter.ts`.

Wave 1 domain ownership is separated as:

- `modules/identity/src/index.ts` — authentication input/session behavior through `AuthProvider`.
- `modules/tenant/src/index.ts` — tenant-access behavior through `TenantRepository`.
- `modules/organization/src/index.ts` — organization hierarchy and assignment behavior through `OrganizationRepository`.
- `modules/rbac/src/index.ts` — permission and role scope through `RbacRepository`.
- `modules/masters/src/index.ts` — master-data behavior through `MastersRepository`.
- `modules/tour-planning/src/index.ts` — weekly plan behavior through `TourPlanningRepository`.
- `modules/tour-approval/src/index.ts` — manager decision behavior through `TourApprovalRepository`.

The provider implementation lives outside those modules in `apps/api/src/supabase-adapter.ts`, which implements the module-defined repository/provider contracts.

## Dependency-direction review

`.dependency-cruiser.cjs` enforces:

1. `no-circular` — circular dependencies are errors.
2. `domain-no-infrastructure-adapters` — anything under `modules/` is forbidden from importing `apps/`.
3. `domain-no-vercel-runtime` — domain modules are forbidden from importing Vercel, the Supabase adapter, or the Vercel runtime.

The CI `quality-security` job executes the repository architecture checks. A passing exact-commit CI run is required by the evidence manifest before final qualification.

## Shared-services review

Shared behavior is reused through explicit service contracts rather than copied into individual modules:

- `modules/rbac/src/index.ts` defines the shared `RbacService`.
- `modules/organization/src/index.ts` receives `RbacService` by dependency injection for organization authorization.
- `modules/masters/src/index.ts` receives both `OrganizationRepository` and `RbacService` for scoped master-data validation.
- `modules/tour-planning/src/index.ts` receives `RbacService` for planning authorization.
- `modules/tour-approval/src/index.ts` receives `RbacService` for approval authorization.
- `apps/api/src/handler.ts` is the composition root that creates one RBAC service and injects it into the modules that require it.

This keeps authorization logic in the shared RBAC service instead of embedding separate vendor/API authorization logic in each domain module.

## Vendor-leakage review

The external persistence/authentication provider is isolated to the infrastructure boundary:

- `apps/api/src/handler.ts` owns the Supabase environment/config aliases.
- `apps/api/src/supabase-adapter.ts` owns Supabase REST/Auth/RPC calls and implements domain repository interfaces.
- Wave 1 domain modules expose provider-neutral TypeScript contracts and do not import `apps/api/src/supabase-adapter.ts`, Supabase SDK/runtime code, or Vercel runtime code.
- `.dependency-cruiser.cjs` makes a domain-to-provider import a CI error.

Therefore replacing the provider would require a new infrastructure adapter and composition change, not a rewrite of Wave 1 domain services.

## Shared-platform review

`packages/contracts`, `packages/domain`, and `packages/testing` exist as platform-level package boundaries but are intentionally minimal in the present Wave 1 implementation. Wave 1 does not claim functionality from those placeholders. Its reusable business behavior is currently expressed through module contracts and injected services.

## Qualification rule

This document is architecture-review evidence only. It does not by itself qualify Wave 1. Final qualification still requires:

- exact-commit CI PASS,
- CodeRabbit APPROVED with zero unresolved material findings,
- all mandatory product gates PASS or explicitly reviewed NOT_APPLICABLE where permitted,
- Product Gates workflow PASS.
