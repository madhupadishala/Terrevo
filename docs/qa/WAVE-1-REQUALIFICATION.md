# Wave 1 Requalification — Sprints 1–5

Status: **IMPLEMENTED / REQUALIFICATION IN PROGRESS**

Qualified implementation candidate: `ddb8b01ff88b8ac28e97358d4429008866c35221`

## Scope

Wave 1 requalifies:

1. Sprint 1 — Identity + Tenant
2. Sprint 2 — Organisation Hierarchy + RBAC
3. Sprint 3 — Core Masters
4. Sprint 4 — Tour Planning
5. Sprint 5 — Tour Approval

The purpose is not to rewrite working code. It is to prove that the current implementation satisfies the requirements, the ten mandatory product gates, and the current release-quality standard.

## Cross-sprint architecture

Identity/Tenant → RBAC/Organisation → Masters → Tour Planning → Tour Approval

The dependency direction is acceptable for Wave 1:
- HTTP/API delegates to application/domain services.
- domain modules depend on explicit repository/service contracts.
- Supabase integration remains in the infrastructure adapter.
- privileged service credentials are used only behind server-side authorization checks.
- tenant and organization boundaries are enforced in both application logic and database policies.

## Sprint 1 — Identity + Tenant

### Requirement evidence
- TRV-ID-001: provider-backed sign-in; passwords are not persisted by Terrevo.
- TRV-ID-002: protected operations require bearer authentication.
- TRV-ID-003: provider-backed logout.
- TRV-ID-004: provider-backed password reset initiation.
- TRV-ID-005: provider-backed refresh-token renewal.
- TRV-TENANT-001/002: active membership discovery and tenant-context validation.
- TRV-TENANT-003/004: PostgreSQL RLS and privilege restrictions.

### Requalification work
- Added direct tests for logout.
- Added direct tests for password-reset initiation and email normalization.
- Added malformed bearer-token failure-path test.
- Added database RLS test proving tenant A cannot see tenant B.
- Added database privilege assertions proving authenticated users cannot directly mutate tenants/memberships.

### Current status
IMPLEMENTED / NOT QUALIFIED — CI and independent CodeRabbit review pending.

## Sprint 2 — Organisation Hierarchy + RBAC

### Requirement evidence
- company → division → zone → region → area → territory hierarchy.
- tenant-scoped parent/child foreign keys and hierarchy trigger.
- one active primary assignment enforced by partial unique index.
- standard TENANT_ADMIN / MANAGER / MR roles.
- server-side permission checks and scoped authorization.
- privileged writes occur only after authorization.
- database boundary test proves cross-tenant organization rows are not visible.

### Current status
IMPLEMENTED / NOT QUALIFIED — CI, CodeRabbit and final evidence review pending.

## Sprint 3 — Core Masters

### Requirement evidence
- employee, doctor, product, chemist, stockist, sample and gift masters.
- tenant-scoped unique codes.
- territory/division ownership constraints.
- same-division sample/product composite foreign key.
- employee-manager organization-branch trigger.
- scoped RLS via has_master_access.
- server-side MASTER_MANAGE checks before privileged writes.
- database boundary test proves cross-tenant doctor visibility is blocked.

### Current status
IMPLEMENTED / NOT QUALIFIED — CI, CodeRabbit and benchmark review pending.

## Sprint 4 — Tour Planning

### Requirement evidence
- one plan per employee/week.
- Monday-starting current/future week enforcement.
- 1–7 days inside week.
- active territory and active target validation.
- unique date, sequence and stop-target constraints.
- atomic save through server-only RPC.
- submitted plans protected from silent editing.
- submission requires at least one stop.
- current RLS prevents cross-tenant plan visibility.

### Current status
IMPLEMENTED / NOT QUALIFIED — CI, CodeRabbit and final Warpath review pending.

## Sprint 5 — Tour Approval

### Requirement evidence
- manager/team scope across all plan territories.
- SUBMITTED → APPROVED / REJECTED / RETURNED transitions.
- required comments for reject/return.
- immutable decision-history table.
- returned plan edit/resubmit support.
- approved/rejected plans not editable.
- database RPC explicitly rejects self-approval.

### Requalification work
- Added service-level tests for non-submitted review rejection.
- Added empty-plan review failure-path coverage.
- Added database qualification test proving self-approval fails.

### Current status
IMPLEMENTED / NOT QUALIFIED — CI and CodeRabbit pending.

## Product Design Guardian

Wave 1 requalification introduces no product UI and therefore does not claim a UI qualification. Product Design Guardian is recorded as NOT_APPLICABLE for these backend/data changes with explicit rationale. When Identity, Masters, Tour Planning or Approval screens are built or redesigned, Figma + Carbon/PatternFly/Radix/browser evidence becomes mandatory.

## Regulatory Knowledge Gate

Wave 1 contains field-force platform infrastructure and does not encode a pharmacovigilance regulatory decision. Regulatory Knowledge Gate is NOT_APPLICABLE with explicit rationale. This does not waive security, audit, evidence or domain correctness requirements.

## Modular & Benchmark Completeness

Wave 1 is assessed against enterprise SFA expectations:
- tenant/company isolation;
- organizational hierarchy and role scope;
- governed master data;
- weekly tour planning;
- manager approval/return/reject flow;
- immutable decision evidence;
- server-authoritative authorization.

No competitor screen is copied. UI benchmarking is deferred until the corresponding web/mobile surfaces are in scope.

## Qualification blockers

Wave 1 must remain **IMPLEMENTED / NOT QUALIFIED** until:
- CI foundation passes.
- mobile regression passes.
- all migrations apply and reverse successfully.
- Wave 1 database boundary tests pass.
- CodeRabbit has zero unresolved material findings on the latest Wave 1 head.
- five evidence manifests are updated with real CI/review evidence.
- the product-gate verifier passes for the exact qualified implementation commit.
