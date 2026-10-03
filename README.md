# Terrevo

Terrevo is a field-force automation platform built under a governed product-development operating system.

## Non-negotiable build rule

**No sprint, feature, fix, release candidate, or deployment is complete until the mandatory product gates pass and the evidence is recorded.**

The canonical flow is:

**Product requirement → domain analysis → market benchmarking → URS → FRS → architecture → design → implementation → verification → independent review → evidence → release**

Direct feature development on `main` is prohibited. Work must be isolated to a scoped branch and merged only through a reviewed pull request.

## Product-development operating system

The complete governance model lives in:

- `docs/governance/PRODUCT-OPERATING-SYSTEM.md`
- `governance/product-gates.json`
- `docs/evidence/TEMPLATE.product-gates.json`
- `.github/pull_request_template.md`
- `.github/workflows/product-gates.yml`

Every agent and contributor must also follow `AGENTS.md`.

## Mandatory gates

Every change must pass:

1. Karpathy Gate
2. Ponytail Gate
3. Product Design Guardian
4. Architecture Guardian
5. Warpath Gate
6. CodeRabbit Gate
7. Hacker Gate
8. Evidence Gate
9. Regulatory Knowledge Gate
10. Modular & Benchmark Completeness Gate

A gate may be recorded as `NOT_APPLICABLE` only when the evidence manifest contains a specific rationale and reviewer **and that declaration exists unchanged in the implementation commit that receives a trusted CodeRabbit `APPROVED` review**. Evidence-only commits may not add or modify a `NOT_APPLICABLE` declaration. It is never equivalent to skipping the gate.

## Release checks

The release pipeline also requires, as applicable:

- TypeScript / static analysis
- lint and formatting integrity
- unit and integration tests
- relevant E2E
- architecture checks
- dependency and secret security checks
- module regression
- production build
- browser verification
- UI/design verification
- migration forward/reverse verification
- traceability and evidence completeness
- exact commit qualification
- rollback readiness

## UX and product benchmarks

UI work must use Figma as the design source of truth and benchmark dense enterprise patterns against IBM Carbon. PatternFly is a secondary enterprise workflow/admin reference. Accessible behavior should follow Radix-quality interaction semantics, while shadcn/ui is a React composition benchmark. v0 may be used for exploration, never as unreviewed production output.

A passing build is not a passing UI. Browser verification and Product Design Guardian evidence are mandatory for UI-affecting changes.

## Architecture

Canonical dependency direction:

```
Presentation / API
        ↓
Application Services
        ↓
Domain
        ↓
Platform Interfaces
        ↑
Infrastructure Adapters
```

Modules must remain independently entitleable and communicate only through explicit contracts, commands, queries, or events.

## Completion definition

A sprint is complete only when:

- acceptance criteria are satisfied;
- the exact implementation commit is identified;
- all applicable mandatory gates are PASS;
- any NOT_APPLICABLE gate has its rationale and reviewer bound unchanged to the trusted CodeRabbit-approved implementation commit;
- automated CI/release checks are green;
- CodeRabbit has no unresolved material finding;
- required design/browser/security/regression evidence is attached;
- URS/FRS/architecture/user documentation is updated when impacted;
- rollback is documented and tested where material;
- the evidence manifest passes `npm run verify:product-gates`.

Until then, status must be **IN PROGRESS**, **BLOCKED**, or **IMPLEMENTED / NOT QUALIFIED** — never COMPLETE.
