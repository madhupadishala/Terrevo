# Sprint 10 — Samples + Gifts

Status: CLOSED

- **TRV-INV-001** — Sample/gift inventory shall be tracked per employee with a non-negative balance.
- **TRV-INV-002** — Tenant admins/managers with INVENTORY_MANAGE may issue stock only to employees inside their organization scope.
- **TRV-INV-003** — Issued items must belong to the employee's division and be active.
- **TRV-INV-004** — An MR may return quantity only from their own available balance.
- **TRV-INV-005** — Samples/gifts may be distributed only during the MR's open doctor visit.
- **TRV-INV-006** — A distribution supports 1–20 unique sample/gift lines and is all-or-nothing.
- **TRV-INV-007** — Inventory operations are idempotent; reusing an operation UUID with a different payload is rejected.
- **TRV-INV-008** — Insufficient balance blocks distribution/return and no balance may become negative.
- **TRV-INV-009** — Every issue, return and distribution writes an immutable ledger entry with resulting balance.
- **TRV-INV-010** — DCR checkout snapshots sample/gift distributions with item code/name and quantity.
- **TRV-INV-011** — MRs see their own inventory; managers see team inventory according to INVENTORY_VIEW_TEAM scope.

## API

- GET /v1/inventory
- POST /v1/inventory/issues
- POST /v1/inventory/returns
- GET /v1/visits/:visitId/distributions
- POST /v1/visits/:visitId/distributions
