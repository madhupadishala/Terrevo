# Sprint 22 — Durable Offline / Sync Hardening

Status: ACTIVE

Sprint 22 turns the existing identity-scoped critical retry records into a visible, replayable foreground sync queue. It does not invent local server records, bypass server validation, or add continuous background tracking.

- **TRV-SYNC-001** — Existing critical mutation retry records shall remain bound to authenticated user + tenant + operation scope and retain the original server idempotency key and payload.
- **TRV-SYNC-002** — New retry records shall be indexed per user + tenant so the client can enumerate unsynced work after restart. Pre-v0.28 unindexed records remain recoverable through their original action path and are indexed when loaded.
- **TRV-SYNC-003** — Queue records shall expose created time, attempt count, last attempt, last error, and status `PENDING` or `DEAD_LETTER`.
- **TRV-SYNC-004** — Foreground sync shall replay pending actions in creation order through the same API contracts and same operation IDs. Replay shall never mint a replacement operation ID.
- **TRV-SYNC-005** — Network failures, authentication interruption, HTTP 408/425/429 and 5xx responses remain pending. Sync stops on a retryable infrastructure/auth failure rather than burning through the queue.
- **TRV-SYNC-006** — HTTP 400/403/404/409 is a definitive replay failure and shall move that item to dead-letter instead of silently deleting evidence.
- **TRV-SYNC-007** — A user may explicitly retry dead-letter items; retry preserves the original operation ID and payload.
- **TRV-SYNC-008** — Sync status shall be visible in the field app with pending/dead-letter counts, recent items, last errors, and a manual Sync Now action.
- **TRV-SYNC-009** — Tenant/session boundaries shall never replay another account or tenant's queue. Switching tenants clears only in-memory sync view; persisted records remain identity-scoped.
- **TRV-SYNC-010** — Checkout presence evidence remains on its existing stronger user + tenant + visit binding and is not folded into generic mutation replay.
- **TRV-SYNC-011** — Actions that need a server-generated identifier shall not fabricate one locally. If a queued prerequisite has not synced, dependent workflow remains blocked until server acknowledgement.
- **TRV-SYNC-012** — No database schema, backend endpoint, RBAC, inventory, DCR, order, attendance, expense or manager-approval contract changes are part of Sprint 22.
- **TRV-SYNC-013** — Sync is foreground/user-driven only in this sprint. No 24/7 location or background execution is introduced.
