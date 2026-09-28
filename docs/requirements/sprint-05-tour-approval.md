# Sprint 5 — Tour Approval

Status: CLOSED

## Requirements
- **TRV-APR-001** — Managers shall list submitted plans only when their TOUR_VIEW_TEAM scope covers the whole plan.
- **TRV-APR-002** — APPROVE moves SUBMITTED → APPROVED.
- **TRV-APR-003** — REJECT moves SUBMITTED → REJECTED and requires a comment.
- **TRV-APR-004** — RETURN moves SUBMITTED → RETURNED and requires a comment.
- **TRV-APR-005** — The plan owner shall never approve/reject/return their own plan.
- **TRV-APR-006** — Every decision shall be immutable audit history with actor, transition, comment and timestamp.
- **TRV-APR-007** — RETURNED plans may be edited and resubmitted; prior review history remains.
- **TRV-APR-008** — APPROVED/REJECTED plans cannot be silently edited.
