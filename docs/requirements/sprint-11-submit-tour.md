# Sprint 11 — Submit Tour

Status: CLOSED

- **TRV-SUBMIT-001** — Submit Tour is the only normal end-of-day close action.
- **TRV-SUBMIT-002** — Submission uses authoritative server time and records worked minutes.
- **TRV-SUBMIT-003** — A CHECKED_IN visit blocks submission.
- **TRV-SUBMIT-004** — PENDING or REJECTED GPS exceptions block submission.
- **TRV-SUBMIT-005** — Every checked-out doctor visit must have its submitted DCR.
- **TRV-SUBMIT-006** — If worked minutes are below required minutes, a short-day reason is mandatory.
- **TRV-SUBMIT-007** — Submission is idempotent by operation UUID and rejects same-key/different-payload replay.
- **TRV-SUBMIT-008** — ACTIVE transitions to SUBMITTED and field mutations requiring ACTIVE execution stop thereafter.
