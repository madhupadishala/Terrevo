# Terrevo — Local-first integration and manual release runbook

**Owner:** Chat 1, Core Engineering. **Release tracker:** [#59](https://github.com/madhupadishala/Terrevo/issues/59). **Integration PR:** [#50](https://github.com/madhupadishala/Terrevo/pull/50).

## Rule: no deployment from ordinary commits
Vercel `git.deploymentEnabled=false` on the repository branches. GitHub CI remains enabled. Manual production deployment occurs **only after** exact-SHA qualification and owner approval. Do not deploy a Chat 2 package branch.

## Developer/CI workflow
From the root of a local checkout on `feature/ui-live-role-workspaces`:

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run verify:release
npm run test:release-safety
npm run verify
npx playwright install chromium
npm run test:e2e
```

`verify:release` is **static only**: checks required APIs, migration/test paths, Vercel auto-deploy disablement and CI gates. It never contacts cloud providers. A green result is **not** proof of business acceptance, database persistence or readiness to deploy.

## Staging safety — do not reuse production database
Live production Supabase project ref: `dfqsnkmmumvjwmvtnlcs`. No safe staging project has yet been provisioned/verified. Create or authorize a **separate** staging environment only after cost acknowledgement and confirmation.

Set these **only in an isolated local shell or approved secret manager**, never in Git or frontend code:

```bash
export TERREVO_ENVIRONMENT=staging
export TERREVO_STAGING_PROJECT_REF=<independent-20-character-staging-ref>
export SUPABASE_URL=https://<independent-20-character-staging-ref>.supabase.co
npm run verify:staging-target
```

The guard refuses the known production ref, non-HTTPS URLs, mismatched refs and absent staging declaration. It does not connect or write to Supabase. API secrets are intentionally not consumed by this script.

## Required real-user UAT on verified staging
1. Provision one approved tenant and active employee records with roles MR, Manager and Tenant Admin. Independently grant Super Admin only through reviewed platform authorization, never by default.
2. Create an authorized plan, obtain manager approval, start and complete a field tour with fresh device GPS.
3. Capture planned doctor/trade visit and DCR; perform distinct unplanned call with actual account, location and manager review; create and submit controlled NCA.
4. Verify every business record persists after page refresh and relogin, including manager-visible audit fields.
5. Verify unauthorized tenant/territory/role requests fail; anonymous users cannot invoke administrative mutations.
6. Test unstable network/idempotent retries, geolocation denial, signed evidence limitations, accessibility and device behavior.

The current Chromium suite uses mocked HTTP fixtures and PostgreSQL CI tests use isolated rollback transactions. Those are necessary **but not sufficient** for this staging UAT.

## Staging API qualification — GET only, separate verified sessions
Once a **separate** authorized staging Supabase project and matching Vercel preview or local API are available, provide three distinct staging bearer tokens through your local shell/secret manager. This checks access; it cannot create accounts, configure RBAC, or complete field records.

```bash
export TERREVO_ENVIRONMENT=staging
export TERREVO_STAGING_PROJECT_REF=<20-character-nonproduction-project-ref>
export SUPABASE_URL=https://<20-character-nonproduction-project-ref>.supabase.co
export TERREVO_STAGING_API_ORIGIN=https://<staging-preview>.vercel.app
export TERREVO_UAT_TENANT_ID=<authorized-tenant-uuid>
export TERREVO_UAT_FOREIGN_TENANT_ID=<second-authorized-tenant-uuid>
export TERREVO_MR_ACCESS_TOKEN=<short-lived-test-representative-token>
export TERREVO_MANAGER_ACCESS_TOKEN=<short-lived-test-manager-token>
export TERREVO_ADMIN_ACCESS_TOKEN=<short-lived-test-tenant-admin-token>
npm run qualify:staging-api
```

The command uses **GET requests only** and tests MR/Manager/Tenant Admin membership, role-specific permission presence, NCA read contract, unplanned-call manager queue, denial of platform tenant enumeration, anonymous read denial and cross-tenant rejection. It refuses the primary production Supabase reference, the production Vercel URL and a missing distinct foreign tenant. It prints only route/status evidence and never prints tokens or response data. The tool does not connect directly to Supabase with privileged credentials and cannot change production records.

**CI:** `npm run test:release-safety` exercises this verifier with isolated mocks to prove forbidden cases cause failure. Such mocks are **not** actual staging-user qualification.

**Remaining evidence even after this command passes:** authenticated write-path UAT, persistence after refresh/relogin, device GPS, NCA and unplanned manager decisions, real approval trail and an independent production rollout check.

## Manual Vercel release gates
- All expected CI jobs green at **one exact commit SHA**; no unresolved blocking review.
- Authorized staging UAT with evidence recorded; no production credentials in preview environments.
- Review and sign off [#59](https://github.com/madhupadishala/Terrevo/issues/59), merge PR #50 only after acceptance.
- Check Vercel deployment quota and manually create a production deployment for the approved SHA.
- Check `https://terrevo.vercel.app`, `/api/health`, login, tenant context, plan/field/manager journeys, data persistence and cross-tenant isolation. Record exact deployment ID, URL, SHA and test evidence.
- Rollback: retain last-known-good Vercel production deployment and compatible DB migration plan. Do not blindly revert security-hardening permissions or destructively reverse migrations after live business writes.

## Chat 2 parallel engineering
- Previous PRs #51–#54 merged.
- Second-wave isolated UI tasks #55, #56, #57, #58 are delegated via `docs/parallel/terrevo-chat2-wave2-contract.md`.
- Chat 2 may author components and tests, but Chat 1 owns server contracts, final integration, security and releases.

## Release evidence checklist
| Gate | Present state |
|---|---|
| GitHub integrated source | PR #50 open; CI passing before release-preflight additions |
| Static release preflight | Added to CI; check latest run |
| Production Supabase baseline/migration safety | Database active and prior rollback-based tests passed |
| Isolated staging project | **Not confirmed** |
| Real-device / real-session multi-role UAT | **Not completed** |
| Exact-SHA Vercel production promotion | **Not completed** |
| Formal release signoff | **Not completed** |

This runbook is deliberately conservative: it is a record of what must be proven, not an assertion that release gates have passed.
