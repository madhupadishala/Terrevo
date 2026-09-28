# ADR-008: Full-Plan Scoped Approval
Status: Accepted

A reviewer must have TOUR_APPROVE coverage for every territory in a plan. Partial coverage is insufficient.

Approval writes are checked twice: the API checks each territory with the reviewer's JWT, and the privileged database function independently checks the actor's role/scope before changing status. Decisions are append-only audit records.

RETURNED reopens editing; resubmission returns the plan to SUBMITTED while preserving decision history.
