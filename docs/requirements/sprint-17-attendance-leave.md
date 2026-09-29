# Sprint 17 — Attendance + Leave

Status: CLOSED

- Attendance is derived from tour execution, not a second clock-in system.
- ACTIVE=WORKING; submitted >= required minutes=PRESENT; submitted short=SHORT_DAY.
- Approved leave is reported as FULL_DAY leave or HALF_DAY leave without fabricating work.
- Full-day leave blocks tour start and cannot be approved over an existing tour execution.
- Half-day leave is limited to one date.
- Leave requests are bounded to 31 days and cannot overlap active submitted/approved leave.
- Manager approval is organization-scoped and self approval is blocked.
- Decisions are immutable history.
