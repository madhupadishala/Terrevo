# Sprint 22 — Offline + Sync Hardening

Status: ACTIVE

Sprint 22 hardens retry-safe field writes without pretending server-authoritative field actions can complete offline.

- **TRV-SYNC-001** — Unsynced mutation state shall remain bound to authenticated user + tenant + mutation scope.
- **TRV-SYNC-002** — Queue metadata shall survive app restart and shall not be replayed for another account or tenant.
- **TRV-SYNC-003** — Existing operation IDs and payloads remain the source of retry idempotency; queued replay shall never mint a second operation ID.
- **TRV-SYNC-004** — Retry-safe evidence writes may auto-replay: distribution, doctor/trade call, RCPA, order, daily review, weekly submit, leave, expense save/submit.
- **TRV-SYNC-005** — Time/location-authoritative actions shall never auto-replay: Start Tour, Check-In, Check-Out, Submit Tour, Joint Work join/leave.
- **TRV-SYNC-006** — A retriable transport/5xx failure shall preserve pending state and queue metadata rather than fabricate success.
- **TRV-SYNC-007** — HTTP 400/403/404/409 failures are definitive for the queued payload and shall move a snapshot to dead-letter state for user visibility while allowing corrected re-entry.
- **TRV-SYNC-008** — Auto replay uses bounded exponential backoff metadata; explicit Sync Now may retry immediately.
- **TRV-SYNC-009** — A queue replay shall refresh operational state only after the replay pass completes; it shall not bypass workflow prerequisites.
- **TRV-SYNC-010** — Sync status UI shall show waiting, manual-action-required and needs-attention counts without exposing another identity's queue.
- **TRV-SYNC-011** — Dead-letter entries may be dismissed only by the owning user/tenant after the underlying issue is understood/corrected.
- **TRV-SYNC-012** — Presence evidence keeps its existing stronger user + tenant + visit binding and is not folded into the generic queue.
- **TRV-SYNC-013** — No background GPS, no fabricated timestamps, no optimistic inventory mutation, and no new backend/API/database contract are introduced.

- **TRV-SYNC-014** — Pending retry cleanup and dead-letter transitions shall be conditional on the exact scope + operation ID so a replay can never delete or overwrite a newer same-scope operation.
