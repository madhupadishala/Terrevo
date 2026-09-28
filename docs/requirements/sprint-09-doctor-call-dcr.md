# Sprint 9 — Doctor Call + Automatic DCR

Status: CLOSED

- **TRV-DCR-001** — Doctor-call details can be entered only while the owned doctor visit is CHECKED_IN.
- **TRV-DCR-002** — Call outcome is required; remarks and next action are optional.
- **TRV-DCR-003** — Up to 20 unique detailed products may be captured in explicit sequence.
- **TRV-DCR-004** — Detailed products must be active in the doctor territory's ancestor division.
- **TRV-DCR-005** — Doctor-call saves are atomic and idempotent by operation UUID; reusing the key with different payload is rejected.
- **TRV-DCR-006** — A doctor visit cannot check out until call details exist.
- **TRV-DCR-007** — Doctor checkout creates an immutable SUBMITTED DCR snapshot in the same database transaction.
- **TRV-DCR-008** — DCR snapshots preserve doctor/product names and codes plus GPS verification state at submission time.
- **TRV-DCR-009** — Chemist/stockist checkout remains unaffected and does not create a DCR.
- **TRV-DCR-010** — Authenticated users receive read-only access to DCRs according to visit owner/team scope.

## API

- GET /v1/visits/:visitId/doctor-call
- PUT /v1/visits/:visitId/doctor-call
- GET /v1/dcrs
- GET /v1/dcrs/:dcrId
