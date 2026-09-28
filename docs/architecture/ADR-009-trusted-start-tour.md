# ADR-009: Trusted Start-Tour State
Status: Accepted

Start My Tour is a server transaction. The device supplies an idempotency UUID and location/device evidence, but it never determines authoritative start time or execution ownership.

The approved plan day and tenant timezone are revalidated inside PostgreSQL. A unique operation key makes retry safe; unique employee/day and active-execution constraints make double starts safe under concurrency.

GPS geofence acceptance is deliberately Sprint 8. Sprint 6 captures location evidence only.
