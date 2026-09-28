# ADR-007: Atomic Weekly Tour Plan Writes
Status: Accepted

Weekly planning is saved as one atomic database operation. The API validates shape and user scope first, then one privileged RPC replaces the draft's day/stop graph inside a transaction.

This prevents a network failure from leaving a half-updated week. Authenticated users retain read-only table access; write access is available only through server-side RPC after TOUR_PLAN_OWN authorization.

Sprint 4 deliberately stops at DRAFT → SUBMITTED. Approval transitions are Sprint 5.
