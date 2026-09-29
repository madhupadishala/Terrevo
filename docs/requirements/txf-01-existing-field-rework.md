# TXF 01 — Existing MR Field Flow Rework

Status: ACTIVE

- **TRV-TXF-001** — Start My Tour shall be presented as the MR's workday start/clock-in while preserving the existing server-authoritative tour-start contract.
- **TRV-TXF-002** — Submit Tour shall be presented as the normal workday close and shall make clear that the daily timesheet is generated from trusted execution evidence.
- **TRV-TXF-003** — The mobile app shall expose generated daily timesheet totals without allowing calculated values to be edited.
- **TRV-TXF-004** — The MR may review a generated daily timesheet once with an optional remark using the existing idempotent review contract.
- **TRV-TXF-005** — The mobile app shall expose weekly timesheet totals derived from reviewed daily evidence and use existing generate/submit contracts.
- **TRV-TXF-006** — Sample/gift entry shall display authoritative available balance and a non-authoritative projected post-call balance before submission.
- **TRV-TXF-007** — Existing GPS, tenant isolation, DCR snapshot, inventory ledger and retry/idempotency controls shall remain unchanged.
- **TRV-TXF-008** — No new dependency, backend API contract or database migration is permitted for this rework.
- **TRV-TXF-009** — The MR mobile experience shall read only the authenticated employee's daily and weekly timesheets even when the account also has team-view permissions; team-visible records remain available through manager workflows.
