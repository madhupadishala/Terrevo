# Sprint 20 — Manager Command Center

Status: CLOSED

- Command Center is a read-only operational projection, not an analytics warehouse.
- Access requires MANAGER_DASHBOARD_VIEW and active tenant membership.
- Team counts are filtered through existing scoped permissions.
- It reports team members, active tours, submitted tours today, short days today and active joined joint-work sessions.
- Action counts and bounded queues cover tour approvals, GPS exceptions, weekly timesheets, leave and expenses.
- Every queue reuses the permission required to perform the underlying action; there is no broad manager bypass.
- Server time and tenant-local date are returned with the projection.
- Each queue is capped at 50 items while the count remains complete.
