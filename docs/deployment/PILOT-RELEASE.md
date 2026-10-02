# Terrevo Pilot Release Runbook

## Entry criteria
Pilot promotion is allowed only when:
1. Sprint 22 offline/sync PR is merged or included in the exact release commit.
2. Sprint 23 security/audit CI + CodeRabbit gates are green.
3. Sprint 24 automated release gate is green.
4. All UAT-01..UAT-16 rows are PASS with tester, UTC date/time, exact build/commit and evidence reference.
5. The pilot URL is HTTPS and returns the expected hardened health response.
6. A previous known-good commit/release ID is recorded before promotion.

## Release procedure
1. Update all three product version fields together: root package, mobile package, Expo app version.
2. Run `npm run verify:release`.
3. Run `npm run verify:uat`.
4. Build web/API plus Android export.
5. Generate `release-manifest.json`.
6. Dispatch **Pilot Release** with:
   - exact pilot HTTPS base URL,
   - a release ID,
   - confirmation value `PILOT`.
7. Download and retain the workflow artifact as release evidence.
8. Promote/deploy only the exact reviewed commit represented by the manifest.
9. Run pilot smoke against the deployed URL.

## Observation window
During pilot, review at minimum:
- authentication/refresh/logout errors,
- tenant-selection/access-denied anomalies,
- mutation 4xx/5xx rates,
- offline queue dead letters and repeated retries,
- GPS/presence integrity exceptions,
- inventory/order idempotency conflicts,
- audit event continuity,
- API latency and provider failures.

Do not infer user fraud from GPS anomalies automatically; retain evidence and use the configured review process.

## Rollback decision
Rollback the pilot when any of these occurs:
- cross-tenant or authorization leakage,
- repeated duplicate mutation/inventory corruption,
- unrecoverable sync loss,
- critical GPS/presence integrity regression,
- authentication outage caused by the release,
- migration failure or audit corruption,
- sustained critical API failure attributable to the release.

## Rollback steps
1. Stop further pilot promotion.
2. Record incident time, release ID, commit and affected tenant(s).
3. Redeploy the previously recorded known-good commit/artifact.
4. If the failed release introduced a DB migration and application rollback is incompatible with it, apply only that release's documented down migration(s) in reverse order.
5. Re-run health + security smoke and the impacted critical workflow.
6. Preserve audit logs and failed-release artifacts; do not delete evidence.
7. Open a defect and require the normal four-principle review before retrying.

## Pilot exit criteria
Pilot exits successfully only after the agreed observation period has no blocking defects, audit continuity is verified, critical user flows remain green, and rollback readiness remains intact.
