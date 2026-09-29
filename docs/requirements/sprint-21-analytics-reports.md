# Sprint 21 — Analytics + Reports

Status: ACTIVE

Sprint 21 is read-only analytics over trusted field evidence. It does not introduce AI, manual duplicate reporting, a data warehouse, or mutable analytics records.

- **TRV-ANL-001** — Manager analytics shall require `MANAGER_DASHBOARD_VIEW` and preserve tenant/org scope server-side.
- **TRV-ANL-002** — Analytics windows shall be tenant-local rolling periods between 1 and 90 days; mobile exposes 7-day and 30-day views.
- **TRV-ANL-003** — Tour metrics shall include submitted tours, short days, total worked minutes, and average worked minutes.
- **TRV-ANL-004** — Coverage shall derive from planned stops versus checked-out visits and include doctor, chemist, stockist and unique-doctor coverage.
- **TRV-ANL-005** — Productivity shall derive calls per submitted tour from field evidence; no user-entered productivity value is accepted.
- **TRV-ANL-006** — Order analytics shall report booked order count and ordered units only; monetary value shall not be invented because price/tax is not part of the order contract.
- **TRV-ANL-007** — RCPA analytics shall aggregate recorded prescription, stock and sales observations without inferring missing values.
- **TRV-ANL-008** — Attendance analytics shall derive present/short-day work records and approved full/half-day leave evidence.
- **TRV-ANL-009** — Expense analytics shall group submitted/approved claim totals by currency; different currencies shall never be summed together.
- **TRV-ANL-010** — Analytics is read-only and must not mutate tour, visit, DCR, order, RCPA, attendance, leave, expense or inventory records.
- **TRV-ANL-011** — No AI prediction, ranking, target fabrication, or synthetic performance score is in Sprint 21.
