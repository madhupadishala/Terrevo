# Sprint 6 — Start My Tour

Status: CLOSED

- **TRV-EXEC-001** — Start My Tour requires an approved plan day owned by the authenticated employee.
- **TRV-EXEC-002** — The plan day must match the tenant-local current date.
- **TRV-EXEC-003** — Only one execution may exist for an employee/work date and only one ACTIVE execution at a time.
- **TRV-EXEC-004** — Start is idempotent by client operation UUID.
- **TRV-EXEC-005** — Server time is authoritative; device time is stored only as evidence.
- **TRV-EXEC-006** — Start captures latitude, longitude, accuracy, device/network/app metadata.
- **TRV-EXEC-007** — Required work duration starts at 480 minutes and is stored on the execution.
- **TRV-EXEC-008** — Tenant timezone controls local work date.
