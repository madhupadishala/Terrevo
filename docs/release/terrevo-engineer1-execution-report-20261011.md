# TERREVO V3.2 — Engineer 1 implementation and qualification

2026-10-11. Real implementation and live staging evidence now replace the earlier credential-blocked report. The eight work packages have concrete delivered changes and qualification results. **Full formal acceptance is not complete; engineering release remains HOLD.** The remaining failures and human/device gates below are not marked passed.

## Source and verification

- Engineering code: `475e6810cf7c061c9f804b74d917ef6cc4595bd6`; tree `b5e6b329ec32502ef5957cce9001856a64f8593c`.
- [All five CI jobs passed, run 38143712459](https://github.com/madhupadishala/Terrevo/actions/runs/38143712459): foundation, mobile, database migrations, browser smoke and ownership.
- Delivery: [PR #65](https://github.com/madhupadishala/Terrevo/pull/65), against `feature/ui-live-role-workspaces`, base `473e74b549eead71226f6c4204c945e22f4d6bd7`.
- Deployed staging API: exact runtime source `d3d0e085e186579d722e19ddde0474982d6a2372`, Edge version 4, bundle SHA-256 `ad807880a792b5c5373894cc97a0cdbf16e4f6585339e0b96c3ea5ab8215bfaf`. Subsequent engineering changes affect qualification tools and the mobile UUID override.
- This report is a documentation revision after that engineering source. Its containing commit and PR checks identify that revision; the earlier CI run is not attributed to a later commit.
- Machine-readable facts: `engineer1-qualification-final-20261011.json`. The older `engineer1-evidence-20261011.json` records an earlier snapshot and is historical.

| Verification | Observed result |
|---|---|
| API/domain tests | 125 passed |
| Shared/delegated web tests | 41 passed |
| Release-safety tests | 27 passed |
| Mobile queue/model tests | 12 passed |
| Browser scenarios | 13 passed in hosted CI |
| TypeScript, frozen installs, web/API build, Android export | Passed in exact-source CI |
| PostgreSQL migration forward/reverse, policy/lifecycle suites | Passed in exact-source CI |
| Critical-write races | 16 independent sessions released through a synchronized advisory-lock barrier; one unchanged execution and visit |
| PostgreSQL backup/restore | Actual marked safe-data dump into a separate CI database, restore/RLS assertions and policy/lifecycle reruns passed |

Local browser execution was unavailable because the Chromium download failed. Hosted browser evidence is explicitly distinguished from local execution. There is no repository lint script; no lint suite is invented. Local affected tests, type checks and whitespace checks passed.

## Results for all eight work packages

Closure order remains R01 → R03 → R04-A → R05 → R06-A → R10-A → R11-A → R12-A. The original attached contract and R00 are preserved. Their R10/R11 descriptions are treated as a union of administration, reporting, security, performance and adapters; generic scope approval is no longer used to stop implementation.

| Package | Implemented and qualified work | Remaining acceptance |
|---|---|---|
| R01 | Audited 63 remote refs and PR history; one canonical integration delivery; trusted repository/author/branch ownership and both rename sides enforced; reproducible locks/builds; reviewed PR64 backend source integrated with ancestry | Authorized baseline acceptance and final independent review. Wave 2 UI remains isolated until its contracts qualify. |
| R03 | Existing free staging verified; six supported GoTrue identities across two isolated tenants; actual role, tenant, missing-permission, direct RLS/CRUD/RPC and refresh-revocation tests; all 61 public tables have RLS; additive security migrations installed; real PostgreSQL restore tested | Broader managed Auth/Storage/configuration recovery is not established by PostgreSQL-only CI. Qualified evidence is synthetic engineering staging, not production recovery acceptance. |
| R04-A | Real authenticated persisted plan/start/visit/call/DCR/unplanned/NCA/expense/leave operations, relogin/refresh reads and manager decisions; identical operation replay, conflicting evidence rejection, four concurrent HTTP start retries and sixteen-session DB races | Final API/product-contract acceptance and representative capacity qualification. No large-fleet capacity claim. |
| R05 | Complete synthetic planned journey through approval, GPS validation, check-in/call/checkout and day closure; submitted records reconcile; mobile retry/recovery models pass; open joint-work correctly blocks day closure | Physical GPS permissions/accuracy, device interruption and representative offline/network UAT remain unperformed. Synthetic coordinates cannot prove presence. |
| R06-A | Existing manager/admin register traced through domain/API/DB; daily review, weekly generation/submission/approval, leave, expense, unplanned review and full joint-work schedule/join/leave verified live; fixed an actual joint-work confirmation defect | Acceptance of coverage against the original assigned-service register; existing routes are not a substitute for an unidentified additional business requirement. |
| R10-A | Live platform tenant creation/deactivation and attributed audit; temporary platform grant revoked and subsequent API access denied; request-scoped audit actor isolation; private elevated helpers; no client mutation bypass; safe logs/timing; dependency remediation and measured load | End-to-end p99 budget fails; two upstream toolchain advisories remain. Paid leaked-password protection is unavailable under the zero-cost constraint; its advisor warning is retained. |
| R11-A | Actual manager aggregates reconcile to two submitted tours, two completed visits and two DCRs; approved unplanned/NCA remain separate; 1–90-day bounds and unauthorized role checks; measured 90-day SQL query; canonical relationship transport and frontend adapter; stale account/tenant completions rejected | Full agreed metric/adapter acceptance. Wave 2 history, CLM approval/evidence and immutable snapshot/export requirements remain explicit contract gaps, not fabricated data. |
| R12-A | Identifiable tested source, migration/rollback/recovery evidence, reviews with targeted fixes, final handoff and this consolidated packet; production remains manual and unchanged | HOLD until the required independent acceptance, device evidence, latency/security dispositions and remaining approved contracts qualify. |

## Live data and implementation fixes

Only existing `Terrevo-Staging`, ref `eirlubfbjexjilvskqxq`, was changed. Production ref `dfqsnkmmumvjwmvtnlcs`, main and production deployment remain unchanged. No paid project, branch or subscription was created. The staging endpoint uses the existing API/domain/provider stack with server credentials confined to the provider runtime.

Supported Auth provisioning uses the GoTrue Admin API, fixed identities, a hashed nonce, an expiry, strict staging guard and bounded requests. Replay reconciles only an exact email with matching qualification run/role metadata; unrelated accounts cannot be taken over. Transport/provider failures retain partial created IDs without exposing credentials. Unfiltered discovery first returned two controlled provider failures. Supported exact-email filtered discovery then passed twice, returning the same six owned IDs without new identities. Both failures remain in `engineer1-auth-replay-20261011.json`. The provisioner is disabled (version 8) and a subsequent authenticated invocation returned 410. Existing legacy SQL-fabricated Auth fixtures were preserved and are not presented as supported sign-ins.

Fixture grants now check every required and optional identity against exact Auth ID, canonical email, qualification run and role before any insert. The generated guard passed against six supported identities and rejected 18 swapped-ID/wrong-role/wrong-email variants in a rollback transaction without business writes. `engineer1-identity-guard-20261011.json` records this check. A fresh paginated governance scan recovers an already committed tenant after a lost create response, with no duplicate creation; incomplete scans fail before creation. No temporary platform grant was reactivated for this correction.

The isolated synthetic run `eng1-3809150601dc` contains MR, manager, tenant admin, foreign MR, second MR and an unscoped member. Its current persisted results are:

| Source | Count/status |
|---|---|
| Submitted tours / completed visits / DCRs | 2 / 2 / 2 |
| Completed joint-work assignment | 1 |
| Approved weekly timesheet | 1 |
| Approved unplanned call / submitted NCA | Separate records from planned coverage |
| Attributed audit events after the correction | 21 |
| Temporary platform grant | Inactive; fresh signed-in request denied with 403 |
| Governance test tenant | Inactive |

The real manager-service run discovered an incorrect PostgREST foreign-key embedding name: scheduling committed, then its confirmation read failed. The adapter now references the installed composite tenant/target foreign key. Retrying the original operation returned the same assignment. Daily/weekly review, participant join/leave, submission blocking and manager reconciliation then completed. A focused adapter regression covers all three read paths.

Audit events previously recorded null actors for service-role HTTP mutations. Validated identity is now bound to each request, stamped only on trusted provider REST calls, and consumed only for service-role audit writes. Concurrent requests cannot exchange actors; client actor headers cannot override the signed-in actor. Historical null actors are preserved honestly. The audit migration and internal-trigger privilege migration are installed in staging.

Fourteen elevated client-readable function bodies moved into an unexposed schema while their public signatures remain security-invoker wrappers. Four internal actor-parameterized helpers remain unavailable to clients, including during rollback. Relationship RLS requires active, independently readable source and target customers plus tenant, approval and territory grant. Rollback retains that security floor. Already installed forward migration history is unchanged; the populated rollback FK replacement uses NOT VALID followed by validation after its transaction commits.

The web transport rejects stale responses and retries after an account or tenant change. A canonical CustomerLink type and a pure adapter derive relationship kinds only from current authorized masters, rejecting hidden, ambiguous, inactive, foreign or unevidenced edges. Engineer 2 feature files and approved UI layout are untouched.

## Latency evidence and limits

The budgets were declared before measurement: 60 reads, four simultaneous clients, p95 ≤3,000 ms, p99 ≤5,000 ms, zero unexpected errors. These are engineering small-pilot budgets, not fleet capacity.

| Run | p50 | p95 | p99 | Errors | Result |
|---|---:|---:|---:|---:|---|
| Initial Node transport | 820 ms | 1,347 ms | 9,382 ms | 0 | FAIL p99 |
| Tokyo regional invocation | 440 ms | 717 ms | 8,316 ms | 0 | FAIL p99 |
| Native curl diagnostic | 8,265 ms | 9,796 ms | 10,047 ms | 0 | FAIL latency |

The curl run's application Server-Timing values were p50 164 ms, p95 350 ms and p99 633 ms. A Node request lasting 8,316 ms reported 143 ms inside the handler. This places most observed delay outside the instrumented handler; it does not identify whether proxy, connection, gateway or cold-start behavior caused it. Regional invocation improved the Node p95 but did not close p99. Budgets were not relaxed and failures were not discarded.

A real 90-day manager query on the small synthetic fixture took 76.822 ms using EXPLAIN ANALYZE. Identity claims were set for this SQL diagnostic; the separate API tests use actual GoTrue sign-ins. The function-level plan does not expose all nested scans, and a two-tour fixture does not establish large-result performance.

## Dependencies, review and recovery

The mobile xcode→uuid dependency is overridden to patched 11.1.1. Xcode generated 100 valid distinct project UUIDs; the vulnerable small-buffer v5 call now throws RangeError. Mobile TypeScript, 12 tests and Android export pass; exact-source CI also passes. Moderate audit entries fell from seven to zero. Fifteen propagated high entries remain from node-forge ≤1.4.0 and braces ≤3.0.3. No safe published compatible fix was established; unsafe Expo/React Native downgrades were not applied. No acceptance or waiver is invented.

Current staging security advisors retain ten INFO entries for intentionally client-inaccessible audit/operation tables and one WARN for disabled leaked-password protection. The former fourteen authenticated SECURITY DEFINER warnings are cleared. [Supabase documents leaked-password protection as Pro-plan-and-above](https://supabase.com/docs/guides/auth/password-security); the zero-cost requirement is preserved.

Actual CodeRabbit findings have received targeted fixes and evidence replies, including synchronized races, counterpart access, safe rollbacks, runtime logging, bounded pagination, Auth replay and atomic private recovery checkpoints. All inline review threads are resolved, including the three final findings on tenant recovery, fixture identity grants and simulated Auth response loss. The corrected response-loss regression now stores the created user and throws, requires 502, then reconciles from a fresh handler with one creation. Current code passes all five CI jobs. Independent final re-review and baseline acceptance remain separate; historical CHANGES_REQUESTED reviews are not dismissed. The local CodeRabbit CLI is unavailable.

The PostgreSQL CI restore is real, guarded and separate from staging. It does not restore managed Auth, Storage or provider configuration. Staging SQL tests are rollback-isolated; some later full-suite reruns were interrupted by connector `Invalid or expired requestState`, not a database assertion. Exact-source hosted migration/policy/recovery CI passed. The connector subsequently installed the audit migrations and completed actual read-only reconciliation and privilege checks.

## Handoff and final gates

Canonical contracts are in `docs/parallel/engineer1-backend-handoff-20261011.md`. PR64 backend source `300f36cc5aa922a27f36bbeb3f778ebbe21af4cd` is integrated. Its later `71fd8a295a54749c0c39af513416f95a64dbb09b` adds a separate qualifier for legacy fixed fixtures; it is not selected over the canonical supported-identity runners. Wave 2 PRs #60–#63 remain isolated, with missing server facts explicitly listed. No patient history, MLR approval, receipt verification or report snapshot/export was invented.

Retained failed attempts are individually marked: the initial checkout expectation incorrectly required 409 instead of the existing business-validation 400; joint-work's confirmation failure led to the adapter fix; a resumed 204 approval was retried because of a harness truthiness bug, now corrected. Successful checkpoints and later assertions establish the final software scenarios; historical attempts remain visible.

Karpathy/Ponytail review: existing stack and canonical boundaries reused; changes trace to the eight packages; no approved UI redesign or direct Expo/React Native upgrade. WARPATH is GO for the bounded verified staging corrections and **HOLD for integration/release**. Final blockers are independent baseline/release acceptance, physical-device UAT, the retained latency failure, unresolved upstream security exposure and acceptance of remaining approved service/metric/adapter contracts. They cannot be replaced by self-authored approvals or synthetic device evidence.

Rollback uses reviewed code reverts and the corresponding additive down migrations, preserving business rows and security floors. Automatic production deployment remains disabled. Production deployment requires its own authorization and qualified release gate.

## External dependencies and exact resolution

| Unfinished gate | Owner | Specific resolution |
|---|---|---|
| Independent baseline and release acceptance | Authorized repository reviewer / founder | Review PR #65 at its final head and record the acceptance decision; historical CHANGES_REQUESTED reviews have not been dismissed. |
| Representative device/GPS/offline UAT required by R00 | Field UAT owner with access to physical devices | Execute permission denial, inaccurate/unavailable GPS, app interruption, network loss, persisted retry and resumed-day scenarios; provide dated device evidence. |
| End-to-end latency budget failure | Infrastructure/network diagnostic owner | Identify the delay outside the measured handler and qualify the same declared p95/p99 budgets from representative clients; the three failed runs remain evidence. |
| node-forge and braces high advisories | Upstream maintainers and authorized security reviewer | Supply compatible patched releases or an explicit reviewed risk disposition with exposure evidence; no self-authored waiver or unsafe framework downgrade. |
| Exact remaining service/metric/adapter acceptance | Product/clinical/data owners and Engineer 2 integration reviewer | Confirm the approved service/metric register and provide authorized history, asset approval, receipt/policy and snapshot/export source contracts before those Wave 2 views are mounted. |

PostgreSQL backup/restore is verified. Broader managed Auth/Storage/configuration recovery remains outside that demonstrated result and requires its own approved recovery scope if expected. Production deployment remains a separate authorized action.
