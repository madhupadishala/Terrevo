# TXF 05 — Cross-Module Hardening

Status: ACTIVE

- **TRV-TXF-033** — Every generic critical-mutation retry key shall be scoped by authenticated user and tenant before it is written to or read from device secure storage.
- **TRV-TXF-034** — A pending mutation created for one account or tenant shall never be reused by another account or tenant on the same device.
- **TRV-TXF-035** — Pre-checks for pending critical work, including doctor distribution-before-checkout, shall use the same identity-scoped retry key as the write operation.
- **TRV-TXF-036** — Switching tenant context shall clear the previous tenant's in-memory tour, master, inventory, timesheet, workforce, manager-command, presence-result and unsaved form state before the new tenant is rendered.
- **TRV-TXF-037** — Logout shall clear tenant-derived in-memory state without deleting unsynced presence evidence that is already explicitly bound to user, tenant and visit.
- **TRV-TXF-038** — Existing presence evidence remains explicitly user/tenant/visit bound and is not weakened or replaced by generic retry storage.
- **TRV-TXF-039** — Legacy pre-0.26 generic retry keys without identity metadata shall not be adopted into another identity context; safety takes precedence over ambiguous legacy recovery.
- **TRV-TXF-040** — General durable offline queueing, conflict resolution and dead-letter/sync-status UX remain Sprint 22 scope; TXF-05 shall not disguise partial critical retry hardening as a full offline engine.
- **TRV-TXF-041** — No database, backend API, RBAC or domain-contract change is introduced by this hardening phase.
