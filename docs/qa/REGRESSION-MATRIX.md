# Production Regression Matrix — Sprint 24

| Capability | Primary automated evidence | Manual UAT |
|---|---|---|
| Identity + tenant isolation | `identity-tenant.test.ts`, DB RLS migrations | UAT-01 |
| Organisation + RBAC | `organization-rbac.test.ts` | UAT-01/UAT-02 |
| Tour planning/approval | `tour-planning.test.ts`, `tour-approval.test.ts` | UAT-02 |
| Tour start/progress/submit | `tour-execution.test.ts`, `tour-progress.test.ts`, `tour-submit.test.ts` | UAT-03 |
| GPS visit integrity | `visit-execution.test.ts`, presence migration round-trip | UAT-04 |
| Doctor DCR | `doctor-call.test.ts` | UAT-05 |
| Samples/gifts + inventory | `inventory.test.ts` | UAT-05 |
| Chemist/stockist | `trade-call.test.ts` | UAT-06 |
| RCPA | `rcpa.test.ts` | UAT-06 |
| POB/orders | `orders.test.ts` | UAT-06 |
| Daily/weekly timesheets | `daily-timesheet.test.ts`, `weekly-timesheet.test.ts` | UAT-07 |
| Attendance/leave | `attendance-leave.test.ts` | UAT-08 |
| Expenses | `expenses.test.ts` | UAT-09 |
| Joint work | `joint-work.test.ts` | UAT-10 |
| Manager command | `manager-command.test.ts` | UAT-11 |
| Analytics | `analytics.test.ts` | UAT-11 |
| Offline/sync | `apps/mobile/test/sync.test.ts` | UAT-12..14 |
| Security boundary | `security.test.ts` | UAT-15 |
| Audit migration | PostgreSQL 16 (`migration-roundtrip` job): full forward/reverse CI | UAT-16 |

## Closure policy
A green automated matrix establishes regression readiness only. It does not convert manual rows to PASS.
