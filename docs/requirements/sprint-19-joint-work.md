# Sprint 19 — Joint Field Work

Status: CLOSED

- Manager/admin schedules an active participant to accompany a target employee on a current/future date.
- Scheduling is scoped to the target employee organization; target and participant must differ.
- When the target tour starts, matching planned assignments link to that execution.
- The participant explicitly joins/leaves using their authenticated employee identity, trusted server timestamps and location evidence.
- Join/leave operations are idempotent.
- An actually joined but unclosed joint session blocks Submit Tour; a merely planned/no-show assignment does not fabricate completed work.
