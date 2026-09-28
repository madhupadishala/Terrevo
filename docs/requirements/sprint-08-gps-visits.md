# Sprint 8 — GPS Check-in / Check-out

Status: CLOSED

- **TRV-VIS-001** — Check-in requires an ACTIVE owned tour and a planned stop in that tour day.
- **TRV-VIS-002** — Tenant geofence radius is configurable to 50, 100 or 200 metres.
- **TRV-VIS-003** — GPS accuracy is recorded independently and a tenant maximum accuracy threshold is enforced.
- **TRV-VIS-004** — Verification is VERIFIED, OUTSIDE_GEOFENCE, LOW_ACCURACY or NO_TARGET_COORDINATES.
- **TRV-VIS-005** — Non-verified check-in requires an exception reason and enters PENDING review.
- **TRV-VIS-006** — Only one visit may be CHECKED_IN at a time per active execution.
- **TRV-VIS-007** — Check-in and check-out are idempotent by operation UUID.
- **TRV-VIS-008** — Managers with TOUR_APPROVE may approve/reject GPS exceptions; self-review is blocked.
- **TRV-VIS-009** — Show My Tour derives separate pending, in-progress and completed stop state/counts from visit records.
