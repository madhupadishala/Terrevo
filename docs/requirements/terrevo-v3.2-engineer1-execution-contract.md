# TERREVO V3.2 — ENGINEER 1
## DETAILED FDE SPRINT EXECUTION CONTRACT
### Mandatory alongside R00 Production Engineering Standards

**Role:** Principal Forward Deployed Engineer

**Execution:** Autonomous, closure-driven, single continuous execution loop

**Assigned Sprints:** R01, R03, R04-A, R05, R06-A, R10-A, R11-A, R12-A

**Source of truth:** Existing TERREVO sprint specifications, GitHub issues, architectural contracts and Engineer 1 / Engineer 2 ownership agreement.

**Important:** The descriptions below establish detailed engineering work packages. Where an existing approved sprint specification contains more precise business requirements, that specification takes precedence. Do not silently redefine sprint scope.

---

# R01 — REPOSITORY CONSOLIDATION AND INTEGRATION BASELINE

## Objective

Establish one clean, reproducible and reviewed TERREVO V3.2 integration baseline that both engineers can consume independently.

## Mandatory implementation

### R01.1 — Repository audit

- Inspect every active development branch relevant to TERREVO V3.2.
- Review open, draft, merged and superseded PRs.
- Identify duplicate components, APIs, services and database migrations.
- Identify abandoned experimental implementations.
- Reconcile the current backend, frontend and shared contracts.
- Confirm the latest reviewed working baseline.

### R01.2 — Canonical implementation selection

- Identify the authoritative implementation for each shared backend capability.
- Preserve working functionality during consolidation.
- Remove or retire redundant implementations only after compatibility verification.
- Resolve import paths and dependency conflicts.
- Eliminate unnecessary packages where safe.

### R01.3 — Engineering ownership

- Verify Engineer 1 and Engineer 2 file ownership.
- Document shared interfaces and dependencies.
- Prevent concurrent edits to overlapping areas.
- Establish integration expectations for independently developed modules.

### R01.4 — Integration baseline

- Reconcile approved changes.
- Resolve merge conflicts.
- Run installation, compilation, type-checking, linting and relevant automated tests.
- Validate compatibility against existing Supabase migrations.
- Publish one identifiable baseline commit.

## Deliverables

- Canonical repository implementation.
- Reviewed integration baseline.
- Branch and PR reconciliation record.
- Engineering ownership matrix.
- Dependency and architecture map.
- Reproducible build and test evidence.

## Acceptance criteria

R01 closes only when the consolidated baseline builds successfully, applicable tests pass, duplicate implementations are resolved, existing functionality is preserved and the authorized reviewer accepts the integration baseline.

---

# R03 — SUPABASE STAGING QUALIFICATION

## Objective

Establish secure and reproducible Supabase staging infrastructure using authorized test identities and isolated tenants.

## Mandatory implementation

### R03.1 — Environment verification

- Inspect the existing Supabase project configuration.
- Confirm staging is separated from production.
- Validate required database extensions, schemas and migrations.
- Confirm environment variables and connection configuration.
- Verify that privileged credentials remain server-side.

### R03.2 — Tenant architecture

- Confirm tenant and organizational scoping.
- Implement or correct tenant-aware foreign keys and relationships.
- Verify client/company separation where supported by the existing domain model.
- Test tenant creation and authorization boundaries.

### R03.3 — Role-based access

Verify the actual roles defined in the approved TERREVO specification, including applicable MR, manager and administrator permissions.

Test:

- Valid user access.
- Unauthorized role access.
- Cross-tenant access.
- Missing permissions.
- Expired or revoked sessions.
- Direct database access attempts.

### R03.4 — RLS qualification

- Review row-level security policies for every relevant table.
- Ensure application roles cannot bypass tenant restrictions.
- Test SELECT, INSERT, UPDATE and DELETE permissions.
- Reject IDOR/BOLA and tenant identifier manipulation.
- Validate privileged service operations remain controlled.

### R03.5 — Data integrity and recovery

- Verify migration ordering.
- Verify indexes and constraints.
- Test database transactions.
- Test duplicate operations.
- Verify backup and restore against safe test data.

## Deliverables

- Qualified staging schema.
- Tested RLS policy set.
- Authorized test-identity matrix.
- Migration execution evidence.
- Tenant-isolation test results.
- Database recovery evidence.

## Acceptance criteria

R03 closes only when authorized staging identities can perform permitted actions, prohibited actions are rejected, migrations work correctly, tenant isolation is demonstrated and database recovery has been tested.

---

# R04-A — BACKEND API AND PERSISTENCE CONTRACTS

## Objective

Deliver real backend API operations and persistent database functionality for approved TERREVO field workflows.

## Mandatory implementation

### R04-A.1 — API contracts

- Define versioned request and response structures.
- Use strict server-side input validation.
- Standardize API errors.
- Validate authentication, tenant scope and role permissions.
- Provide deterministic success and failure responses.

### R04-A.2 — Daily field journey persistence

Implement the Engineer 1-owned backend functionality required to support the daily MR journey, including applicable:

- Field session initiation.
- Planned field activities.
- Unplanned field activities.
- Customer interaction records.
- Activity completion.
- Session closure.
- Associated timestamps and evidence references.

Use the approved business rules and existing entity definitions.

### R04-A.3 — Planned and unplanned calls

Implement real backend operations for:

- Retrieving authorized planned calls.
- Creating authorized unplanned calls.
- Recording call outcomes.
- Enforcing required business fields.
- Preventing duplicate submissions.
- Linking activities to the correct MR and field session.

### R04-A.4 — Persistence integrity

- Save records in the actual staging database.
- Re-read saved records through authorized APIs.
- Verify transaction rollback on failed writes.
- Prevent cross-tenant record changes.
- Preserve audit attribution.
- Verify idempotency.

### R04-A.5 — Integration contracts

Deliver stable contracts for Engineer 2-owned user interfaces without modifying Engineer 2-owned files.

## Deliverables

- Implemented API endpoints.
- Domain services.
- Database migrations.
- Persistent planned/unplanned call functionality.
- Typed contract definitions.
- API integration tests.
- Authorized frontend handoff specifications.

## Acceptance criteria

R04-A closes only when real authorized API requests produce correct durable database changes, failures are safely handled, tenancy is enforced and Engineer 2 can consume documented contracts.

---

# R05 — FIELD EXECUTION AND DAILY JOURNEY BACKEND

## Objective

Complete the Engineer 1-owned field execution lifecycle and ensure activity records reflect actual permitted field operations.

## Mandatory implementation

### R05.1 — Daily journey lifecycle

Implement the approved state transitions for:

- Starting the field day.
- Managing planned activities.
- Recording unplanned activities.
- Completing or deferring calls.
- Handling interruptions.
- Closing the field day.

### R05.2 — Business validation

- Validate activity ordering where required.
- Apply permitted state transitions.
- Prevent unauthorized completion or reopening.
- Reject duplicate or contradictory field events.
- Preserve reason codes for exceptional actions.

### R05.3 — GPS and activity evidence

Where the approved requirements require location evidence:

- Accept validated location data.
- Preserve source timestamps and accuracy metadata.
- Handle missing or inaccurate coordinates.
- Avoid presenting unavailable GPS evidence as verified presence.
- Protect sensitive location records.

### R05.4 — Recovery

- Test interrupted sessions.
- Verify request retry behavior.
- Preserve idempotency.
- Validate resumed field journeys.
- Ensure that partial failures do not create duplicate completed activities.

## Deliverables

- Field journey domain service.
- State-transition rules.
- Persistent activity records.
- GPS evidence contracts.
- Recovery and idempotency tests.
- Engineer 2 integration handoff.

## Acceptance criteria

R05 closes when authorized field workflows operate consistently through actual APIs and persistence, including invalid transitions, interrupted operations and recovery.

---

# R06-A — OPERATIONAL DOMAIN SERVICES

## Objective

Complete Engineer 1-owned backend services required to support reliable TERREVO field operations and downstream workflows.

## Mandatory implementation

### R06-A.1 — Service inventory

Inspect the original approved R06-A requirements.

Identify the exact assigned services and their dependencies before implementation.

### R06-A.2 — Service implementation

For each assigned service:

- Define domain models.
- Implement validated API contracts.
- Apply tenant and role authorization.
- Implement real persistence.
- Enforce business rules.
- Support idempotent writes where appropriate.
- Maintain auditability.

### R06-A.3 — Cross-service consistency

- Ensure services reuse canonical customers, employees, sessions and activities where applicable.
- Prevent duplicated records and conflicting ownership.
- Enforce transactional consistency.
- Document downstream event or API dependencies.

### R06-A.4 — Failure and concurrency tests

Test:

- Duplicate submissions.
- Concurrent updates.
- Invalid state changes.
- Cross-tenant access.
- Network interruption.
- Partial transaction failure.
- Recovery.

## Deliverables

- Implemented R06-A domain services.
- Stable API contracts.
- Database migration updates.
- Negative and concurrency tests.
- Downstream integration documentation.

## Acceptance criteria

R06-A closes only when every item in the original R06-A scope is implemented, integrated, tested and accepted.

Do not mark the sprint complete based merely on generic service infrastructure.

---

# R10-A — ADMINISTRATIVE AND GOVERNANCE BACKEND

## Objective

Deliver the Engineer 1-owned administrative backend capabilities supporting controlled TERREVO operations.

## Mandatory implementation

### R10-A.1 — Authorized administration

Implement the administrative capabilities explicitly assigned to Engineer 1 in the approved R10-A specification.

### R10-A.2 — Permission enforcement

- Enforce server-side administrative permissions.
- Prevent MR or manager role escalation.
- Verify authorized administration is tenant-scoped.
- Reject unauthorized direct API requests.

### R10-A.3 — Auditability

- Record administrative mutations.
- Preserve actor identity and timestamps.
- Record relevant before/after references where required.
- Protect the integrity of audit records.

### R10-A.4 — Data integrity

- Apply validation to administrative changes.
- Prevent destructive actions without required authorization.
- Test transaction failures.
- Ensure changes do not violate active field-session or customer relationships.

## Deliverables

- Administrative backend services.
- Authorization policies.
- Persistence migrations where needed.
- Administrative audit events.
- Security regression tests.
- Engineer 2 integration contracts.

## Acceptance criteria

R10-A closes when authorized administrative operations work end to end, prohibited access is rejected and all actions preserve required audit evidence.

---

# R11-A — MANAGER REPORTING AND PRODUCTIVITY DATA SERVICES

## Objective

Provide accurate, tenant-safe data services required for manager productivity and operational reporting.

## Mandatory implementation

### R11-A.1 — Reporting data contracts

Define the approved reporting metrics and their source records.

Avoid inventing metric meanings or calculating values from unverified activity states.

### R11-A.2 — Data aggregation

Implement backend queries for applicable metrics such as:

- Assigned and completed field activities.
- Planned versus unplanned calls.
- Employee field productivity.
- Field-session completion.
- Manager review status.
- Approved operational exceptions.

The exact metric set must follow the approved sprint specification.

### R11-A.3 — Authorization

- Restrict managers to authorized reporting scopes.
- Prevent cross-tenant aggregation.
- Apply data minimization.
- Test users with multiple reporting roles.

### R11-A.4 — Accuracy and performance

- Compare aggregated results with known database fixtures.
- Validate counting and date-boundary behavior.
- Test pagination and large-result handling.
- Review query plans and indexes.
- Check report performance under representative workloads.

## Deliverables

- Reporting query services.
- Typed reporting APIs.
- Metric-definition register.
- Authorization tests.
- Accuracy and performance evidence.
- Engineer 2 reporting UI contracts.

## Acceptance criteria

R11-A closes only when reporting values reconcile with actual persisted records, authorized managers receive the correct scope and performance meets measured acceptance thresholds.

---

# R12-A — ENGINEERING QUALIFICATION AND INTEGRATION RELEASE

## Objective

Consolidate the Engineer 1-owned implementation into an engineering-qualified TERREVO V3.2 release candidate.

## Mandatory implementation

### R12-A.1 — Integration baseline

- Reconcile completed Engineer 1 sprint work.
- Consume verified Engineer 2 handoffs where available.
- Resolve integration conflicts.
- Confirm versioned API compatibility.
- Verify database migration compatibility.

### R12-A.2 — Full engineering testing

Execute applicable:

- Unit tests.
- API integration tests.
- Supabase persistence tests.
- RLS tests.
- Security tests.
- Concurrent activity tests.
- Failure recovery tests.
- Browser E2E tests against integrated components.
- Accessibility checks.
- Performance benchmarks.

### R12-A.3 — Review closure

- Review remaining CodeRabbit findings.
- Correct actionable defects.
- Run regression tests after corrections.
- Verify required GitHub checks.
- Request required reviewer approval.
- Reconcile and merge eligible PRs.

### R12-A.4 — Release evidence

Prepare evidence tied to the exact release candidate SHA.

Include:

- Requirements traceability.
- Implemented functionality.
- Automated test results.
- Actual service integration results.
- Database/RLS evidence.
- Security findings and resolutions.
- Performance measurements.
- Failure/recovery evidence.
- Reviewed architectural decisions.
- Release and rollback procedures.

### R12-A.5 — Deployment readiness

- Confirm deployment remains manual or explicitly controlled.
- Verify environment separation.
- Verify zero-cost infrastructure limits.
- Verify secret configuration.
- Document rollback.
- Obtain deployment authorization before production changes.

## Deliverables

- Single integrated release candidate.
- Verified engineering test matrix.
- Complete release evidence package.
- Reviewed PR closure record.
- Deployment readiness report.
- Engineer 2 integration acceptance record.

## Acceptance criteria

R12-A closes as an engineering-qualified release candidate only when all required engineering checks pass, services are verified, security findings are resolved or formally accepted, and the authorized reviewer approves the engineering handoff.

Production qualification remains separate until required deployment, field UAT and production-specific checks are complete.

---

# AUTONOMOUS FDE EXECUTION COMMAND

You are the Principal Forward Deployed Engineer responsible for completing all eight Engineer 1 sprints.

**Your execution sequence is:**

R01 → R03 → R04-A → R05 → R06-A → R10-A → R11-A → R12-A

For every sprint:

1. Read the approved sprint definition and inspect the current implementation.
2. Continue from the most recent verified code rather than restarting.
3. Implement every missing Engineer 1-owned requirement.
4. Integrate it with real APIs, persistence and authorized services.
5. Run relevant tests.
6. Fix every actionable defect.
7. Complete review and CI corrections.
8. Produce commit-specific evidence.
9. Obtain or verify required acceptance.
10. Close the sprint and move immediately to the next.

Do not interrupt the sequence with repetitive planning.

Do not create unnecessary PRs or duplicate services.

Do not change Engineer 2-owned files.

Do not spend money or trigger unnecessary hosted deployments.

Do not treat a green CI status as proof of real service qualification.

**Do not stop when work becomes difficult. Stop only when the assigned actionable engineering work is complete or a genuine external dependency prevents further execution.**

Where approval or live infrastructure access is missing, finish everything independently executable and document the exact external requirement.

## FINAL REQUIRED OUTPUT

Produce one consolidated report covering all eight sprints, with:

- Exact source branch and final commit SHA.
- Sprint-by-sprint acceptance results.
- Evidence of tested functionality.
- Actual Supabase and API integration results.
- Security and failure recovery evidence.
- Engineer 2 handoff contracts.
- PR merge status.
- Any unavoidable external dependency, its owner and its specific resolution.

**ACT AS PRINCIPAL FDE. IMPLEMENT → INTEGRATE → TEST → FIX → VERIFY → CLOSE. EXECUTE THE COMPLETE ENGINEER 1 ASSIGNMENT IN ONE CONTINUOUS LOOP.**