# Sprint 18 — Expenses

Status: CLOSED

- One expense claim is tied to a real tour execution.
- Claim total is calculated from 1–50 positive line items; users do not set the total.
- Categories: travel, meal, lodging, local conveyance, other.
- Currency is explicit 3-letter code; no conversion is invented.
- Receipt reference text is supported; file storage/reimbursement settlement is deferred.
- DRAFT/RETURNED claims are editable, submission is idempotent, and manager approval is organization-scoped.
- Self approval is blocked and review decisions are immutable history.
