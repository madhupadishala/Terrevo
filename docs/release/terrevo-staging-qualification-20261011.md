# Terrevo Staging — Isolation & Database Qualification (2026-10-11)

## Environment
- User-approved incremental cost ceiling: **₹0 / $0**.
- Connected organization: ClinixAI, Supabase Free plan, ID `faozewuquwqdxqbpmvkn`.
- Production (unchanged): `Terrevo`, ref `dfqsnkmmumvjwmvtnlcs`.
- New project: `Terrevo-Staging`, ref `eirlubfbjexjilvskqxq`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`.
- Supabase cost quote: **new project $0/month**; the branch alternative was **$0.01344/hour** and was not created.
- Free plan constraint: two **active** free projects. Existing unrelated `clinixai-pv-platform` was paused at review. Do not resume it while at active free limit without first checking quota. Free tiers may pause for inactivity and have usage limits.
- Staging is a distinct Postgres/Auth/Storage project. Nothing was copied from production.

## What was executed on staging
1. 29 GitHub-versioned migrations applied sequentially from `feature/ui-live-role-workspaces` (0001 through 0025, 9997, 9998, 9999), all successful and recorded in Supabase migration history.
2. Database count: **59 public tables**, **59 RLS-enabled base tables**, **zero tenants**, **zero auth users**, **zero platform-admin grants**, **zero unplanned-call records**, **zero NCA records**.
3. Security checks: zero anonymous-callable `SECURITY DEFINER` functions; zero client-executable privileged `admin_%` functions.
4. Executed the exact repository SQL `database/ci/platform-admin-policy-tests.sql`, `nca-policy-tests.sql`, `unplanned-call-policy-tests.sql`, and `public-definer-privileges-tests.sql`: all passed.
5. Executed the repository `unplanned-call-integration-tests.sql` transaction: creation, replay, authorization denial, manager decision/audit, JWT-simulated RLS; passed, rolled back.
6. Added and executed `database/ci/nca-integration-tests.sql`: controlled categories/towns, MR role, tenant-admin role, PLAN creation, replay, submission, denied category and cross-tenant requests, JWT-simulated RLS. The fixture's original tenant-admin scope was corrected to NULL to satisfy the actual DB constraint. Test passed; rolled back.
7. Rechecked migration history and empty persistent business tables after all tests.

## Security advisor caveats
Supabase reported INFO `rls_enabled_no_policy` (10 tables, intentionally policy-less/restricted in design, but must be reviewed) and WARN `authenticated_security_definer_function_executable` (14 helper functions needed for authorized reads). Passing permission checks does not waive a manual review of helper safety or resolve unrelated Auth password-protection settings.

## Not yet qualified
- **API authentication and real-user browser UAT:** No permanent staging tenant, MR, Manager, Tenant Admin, Super Admin, first-party Auth accounts, controlled NCA catalog or real approved tour yet.
- **Multi-tenant isolation through authenticated HTTP sessions:** SQL tests use controlled JWT simulation; live two-tenant API access validation remains.
- **Device GPS:** Chromium fixtures and rollback SQL do not establish hardware location quality, geofence presence or tamper resistance.
- **Staging web API:** Vercel production project variables remain production-only. No verified staging API preview endpoint and no credential handoff performed.
- **Release:** PR #50 is not production merged. Automatic Vercel deployments are disabled. Do not deploy until role/session/GPS UAT and owner sign-off.

## Next zero-cost engineering steps
1. Update local developer environment to use **only** the staging Supabase URL and project-specific server credentials through a secrets manager (never Git and never public frontend).
2. Provision **test-only** authenticated staging tenant/roles and an isolated foreign tenant as approved, through supported authorization flows with an audit log. Do not copy production users or fabricate real customer interactions.
3. Run `npm run verify:staging-target` and `npm run qualify:staging-api` against a locally running backend with staging session tokens and matching remote runtime attestation.
4. Execute end-to-end planner → approved tour → visit → DCR/unplanned call → manager decision/NCA and verify persistence after reload and permission failures.
5. Capture signed release evidence in [S01–S06 tracker](https://github.com/madhupadishala/Terrevo/issues/59); only then approve manual deployment.

**Conclusion:** Staging provisioning, schema, migration, and database-security transaction qualification completed without new Supabase subscription or branch charges. Runtime/UI production qualification not claimed.
