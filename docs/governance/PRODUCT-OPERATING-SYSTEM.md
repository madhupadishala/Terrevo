# Terrevo Product Development Operating System

## Purpose
This document is the canonical build-and-qualification system for Terrevo. It governs product design, architecture, implementation, security, validation, documentation, AI use, evidence, and release.

**Implementation is not completion. Completion requires qualification evidence.**

## Product-building model
Product requirement → domain analysis → market benchmarking → URS → FRS → architecture → Figma → Carbon-density review → Product Design Guardian → shared components → implementation → Karpathy/Ponytail review → Architecture Guardian → Warpath testing → Hacker testing → CodeRabbit → browser verification → validation/evidence → release.

## Product & UX
- **Figma**: design source of truth.
- **IBM Carbon**: primary benchmark for dense enterprise UI, forms, tables, filters, worklists, status handling, progressive disclosure and information hierarchy.
- **PatternFly**: secondary admin/workflow/configuration benchmark.
- **Radix**: accessibility and interaction benchmark.
- **shadcn/ui**: React composition benchmark.
- **v0**: exploration aid only; output must pass normal gates.

### Product Design Guardian
Verify visual hierarchy, enterprise density, spacing, typography, component reuse, navigation, accessibility, keyboard behavior, responsive behavior, loading/empty/error states, workflow clarity, fake-control prevention, AI/human distinction and browser visuals.

A successful build is not a successful UI qualification.

## React/frontend
Verify component structure, hook correctness, state ownership, rendering efficiency, TypeScript safety, accessibility and reusable patterns. UI changes require browser verification.

## Core engineering gates
- **Karpathy**: understand before editing, smallest correct change, assumptions explicit, verify after material changes.
- **Ponytail**: reuse first, avoid unnecessary architecture, no accidental duplication.
- **Warpath**: unhappy paths, retries, malformed input, state abuse, operational failure and rollback.
- **Architecture Guardian**: module boundaries, dependency direction, shared services, no vendor leakage into domain logic.
- **CodeRabbit**: independent review; unresolved material findings block qualification.

## Architecture
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

Modules remain independently entitleable and communicate via explicit commands, queries, contracts and events.

Shared platform capabilities may include authentication, authorization, audit, evidence, AI gateway, retrieval, event bus, cache, storage, observability and governed knowledge services.

## Security
Hacker Gate and security verification cover IDOR/BOLA, tenant/workspace/environment escape, privilege escalation, session abuse, replay, malformed payloads, hostile uploads, injection, evidence tampering, workflow bypass, dependency security and secret scanning.

## Domain/regulatory knowledge
Every change gets a domain/regulatory applicability assessment. When authoritative knowledge is relevant:

Official source → acquisition → checksum/version metadata → parsing → governed chunking → indexes → authorized retrieval → reranking → AI/human workflow.

Model memory is never authoritative regulatory knowledge.

A non-regulatory change may pass the Regulatory Knowledge Gate as NOT_APPLICABLE only with explicit reviewer-approved rationale.

## AI engineering
Where justified: model gateway, LLMs, LangChain/LangGraph, embeddings, Qdrant, Elasticsearch, hybrid retrieval, reranking, RAG, prompt/policy registry, evaluations, human-in-the-loop, tracing and private/domain-tuned models.

AI must not become an untraceable sole authority for regulated or high-impact decisions.

## Data & infrastructure
Preferred capabilities when justified:
- PostgreSQL: system of record
- Qdrant: semantic retrieval
- Elasticsearch: lexical/full-text retrieval
- Redis: cache, rate limiting, coordination, ephemeral state
- Kafka: asynchronous cross-module events
- object storage: documents/attachments/evidence
- OpenTelemetry-compatible observability: traces/metrics/logs

Do not add technology without a requirement.

## Validation/evidence
Target traceability:

Requirement → URS → FRS → Architecture → Code → Test → Security → Evidence → Release.

Evidence must be versioned and tied to the exact qualified commit. Use checksums/immutable evidence where appropriate.

## Controlled documentation
Treat URS, FRS, user guide, architecture, traceability, design system, validation evidence and benchmark documents as controlled artifacts when applicable.

Standard terminology: **Module, Screen, Tab, Sub-navigation**.

## Ten mandatory gates
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

All are mandatory. NOT_APPLICABLE is a reviewed outcome, never a silent skip. A NOT_APPLICABLE declaration is accepted only when it already exists in the implementation commit that receives a trusted CodeRabbit APPROVED review. Product Gates compares the final evidence manifest with that reviewed manifest and rejects any N/A or impact declaration added or changed afterward. Reviewer names in the manifest are descriptive metadata, not approval authority.

Impact declarations are fail-closed. UI, architecture, database, API-contract, security/tenant, offline/sync and regulatory/domain impacts activate their corresponding mandatory gates, checks and evidence requirements. Architecture-impacting changes require Architecture Guardian PASS; API-contract changes require compatibility evidence and integration checks; offline/sync changes require Warpath PASS plus retry and idempotency evidence.

## Definition of Done
A sprint/change can be marked COMPLETE only when:
1. acceptance criteria are satisfied;
2. exact commit SHA is recorded;
3. evidence manifest exists;
4. every mandatory gate is PASS or reviewed NOT_APPLICABLE;
5. required automated checks are PASS;
6. CodeRabbit has zero unresolved material findings;
7. UI changes have design + browser evidence;
8. migrations have forward/reverse evidence;
9. documentation/traceability is current;
10. rollback is documented;
11. `npm run verify:product-gates -- <manifest>` passes.

Until then use **IN PROGRESS**, **BLOCKED**, or **IMPLEMENTED / NOT QUALIFIED**.

## Enforcement hierarchy
1. branch protection / required GitHub checks;
2. `.github/workflows/product-gates.yml`;
3. `scripts/verify-product-gates.mjs`;
4. evidence manifest;
5. PR template/reviewer evidence;
6. CodeRabbit independent review.

If branch protection cannot be enabled, report it as a governance gap. Direct feature commits to `main` remain prohibited.
