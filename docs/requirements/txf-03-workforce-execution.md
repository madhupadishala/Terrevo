# TXF 03 — Workforce Execution

Status: ACTIVE

- **TRV-TXF-018** — Field-user leave, expense and joint-work self-service reads shall be owner/self scoped even when the account has manager team-view permissions.
- **TRV-TXF-019** — Attendance shall remain derived from trusted tour execution and approved leave; the mobile app shall not introduce a second attendance clock.
- **TRV-TXF-020** — Leave submission shall reuse the existing idempotent leave contract and shall not fabricate attendance.
- **TRV-TXF-021** — Expense claims shall attach to a real tour execution; totals remain server-calculated from positive line items.
- **TRV-TXF-022** — Expense save and submit remain separate retry-safe mutations so an uncertain submit response cannot cause a submitted claim to be overwritten.
- **TRV-TXF-023** — Joint-work participant join/leave shall require fresh foreground location and persisted operation IDs; target employees shall not be offered participant actions.
- **TRV-TXF-024** — Existing manager/team endpoints and approval permissions remain unchanged.
- **TRV-TXF-025** — No database migration or new dependency is introduced by the workforce mobile rework.
