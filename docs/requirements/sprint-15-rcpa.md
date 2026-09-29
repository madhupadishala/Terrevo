# Sprint 15 — RCPA

Status: CLOSED

- RCPA attaches only to an open owned chemist visit.
- 1–50 unique lines may represent either an active company product or a named competitor brand.
- Prescription, stock and sales quantities are explicit observations; at least one must be positive.
- Company products are revalidated against the MR division.
- Save is atomic and payload-aware idempotent.
- RCPA is optional and does not itself block chemist checkout.
- Read visibility follows the underlying visit scope.
