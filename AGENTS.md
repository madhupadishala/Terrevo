# Terrevo Agent Constitution

All coding agents must read this file before changing the repository.

## Prime directive

**Plan → isolate → understand → benchmark → design → build → verify → review → evidence → qualify → integrate.**

No sprint, feature, fix, release candidate, or deployment may be called complete until the mandatory product gates are passed and recorded.

## Scope lock before edits

Before changing code, state:

- requirement/task ID
- sprint/change ID
- responsible module
- allowed paths
- forbidden paths
- expected files
- UI change: YES/NO
- database change: YES/NO
- API contract change: YES/NO
- security/tenant impact
- offline/sync impact
- regulatory/domain impact
- evidence manifest path

Do not modify files outside declared scope. If scope must expand, stop and revise it first.

## Product operating system

The canonical governance model is `docs/governance/PRODUCT-OPERATING-SYSTEM.md`.
The machine-readable gate policy is `governance/product-gates.json`.

Every change must pass all ten mandatory gates:

1. Karpathy
2. Ponytail
3. Product Design Guardian
4. Architecture Guardian
5. Warpath
6. CodeRabbit
7. Hacker
8. Evidence
9. Regulatory Knowledge
10. Modular & Benchmark Completeness

A gate may be `NOT_APPLICABLE` only with a specific rationale and reviewer in the evidence manifest **and only when that declaration exists unchanged in the implementation commit that receives a trusted CodeRabbit `APPROVED` review**. Evidence-only commits may not add or modify the declaration. Never silently skip a gate.

## Design before implementation

For UI-affecting work:

- Figma is the design source of truth.
- IBM Carbon is the primary enterprise-density benchmark.
- PatternFly is a secondary admin/workflow benchmark.
- Radix-quality accessibility/interaction semantics are required.
- shadcn/ui is a composition benchmark, not a license to copy styling blindly.
- v0 may be used for rapid exploration only.
- Product Design Guardian must verify hierarchy, density, spacing, typography, component reuse, navigation, accessibility, keyboard behavior, responsive behavior, loading/empty/error states, workflow clarity, fake-control prevention, AI/human distinction, and browser visuals.
- Browser verification is mandatory after implementation.

## Core engineering principles

### Karpathy
Understand before editing. Prefer the smallest correct change. Avoid abstractions without demonstrated need. Verify after material changes.

### Ponytail
Stop at the first safe rung:
1. No code needed.
2. Existing repository code solves it.
3. Runtime/platform/native capability solves it.
4. Existing dependency solves it.
5. Small local implementation solves it.
6. Only then add abstraction/dependency.

Safety, authorization, auditability, tenant isolation, idempotency, offline recovery, validation, and tests are never removed for simplicity.

### Warpath
Actively test unhappy paths, retries, malformed inputs, state-transition abuse, partial failure, stale data, concurrency, rollback, and operational failure.

### Architecture Guardian
Protect dependency direction, module boundaries, shared platform services, and domain isolation. No vendor SDK leakage into regulated/domain logic.

### Hacker Gate
Adversarially test IDOR/BOLA, tenant/workspace escape, privilege escalation, session abuse, replay, malformed payloads, hostile uploads, injection, evidence tampering, and workflow bypass.

## Architecture

Canonical dependency direction:

Presentation / API → Application Services → Domain → Platform Interfaces ← Infrastructure Adapters

Modules communicate through explicit contracts, commands, queries, and events. A module must not mutate another module's internals.

Shared platform capabilities include authentication, authorization, audit, evidence, AI gateway, retrieval, event bus, cache, storage, observability, and governed knowledge services.

## Data, tenant and offline safety

Cross-tenant access is release-blocking. Submitted business records are not silently overwritten. Prefer additive migrations. Every synchronizable mutation must be idempotent.

Each mobile mutation needs an operation ID, local state, retry policy, conflict strategy, and server acknowledgement.

## AI and knowledge

AI output must be attributable, reviewable, and governed. Model memory is not authoritative regulatory knowledge. Where AI affects regulated/domain decisions, retain provenance, method/model version, evidence, human decision, override rationale, and audit.

## Validation and documentation

When impacted, update controlled artifacts:

- URS
- FRS
- architecture
- user guide
- traceability
- benchmark/design documents
- validation evidence

Traceability target:

Requirement → URS → FRS → Architecture → Code → Test → Security → Evidence → Release

## Automated quality tooling

Use the repository-provided checks for TypeScript, ESLint, dependency boundaries, circular dependencies, dead code, duplication, dependency vulnerability, secret scanning, GitHub Actions, and CodeRabbit when configured.

Do not claim a tool was run unless it actually ran.

## Merge and completion

Before merge:

- all applicable automated checks pass;
- all ten gate results are recorded;
- CodeRabbit has no unresolved material findings;
- UI changes have design and browser evidence;
- security-sensitive changes have Hacker evidence;
- architecture-affecting changes have Architecture Guardian evidence;
- migrations have forward/reverse evidence;
- exact commit qualification is recorded;
- rollback is defined;
- `npm run verify:product-gates -- <manifest>` passes.

Never equate “implementation exists” with “sprint complete.” Use **IMPLEMENTED / NOT QUALIFIED** when code exists but gates/evidence remain incomplete.

## Completion report

Report:

- files changed and why;
- tests and gates run;
- UI/DB/API changes;
- security/offline/regulatory impact;
- evidence manifest;
- exact commit;
- known risks;
- rollback;
- unrelated changes: none / listed.
