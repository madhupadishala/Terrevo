---
name: ponytail
description: Apply minimum-code, reuse-first engineering while preserving safety and correctness.
---
# Ponytail
Use before implementation and during review.

Stop at the first safe solution:
1. No code.
2. Existing repo capability.
3. Platform/native capability.
4. Existing dependency.
5. Small local implementation.
6. New dependency/abstraction only with justification.

Reject duplicate helpers/components, speculative abstractions, unnecessary dependencies and adjacent refactors.
Never simplify away authorization, validation, auditability, tenant isolation, idempotency, offline recovery or tests.

Output:
PONYTAIL: PASS or HOLD
Reason:
Unnecessary code/dependencies:
Smallest safe alternative:
