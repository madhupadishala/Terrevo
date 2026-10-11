# Terrevo V3.2 — reference integration checkpoint

S01: **IN PROGRESS**. This is implemented integration work, not full S01 closure or completion of S02–S10.

## Scope and source selection

Owner requested the handoff as the implementation specification and the attached field guide only as functional inspiration. Terrevo branding and its React/TypeScript/Vite/Carbon stack remain canonical. No screenshots, branding, access codes or third-party UI assets were copied.

Base: `feature/ui-live-role-workspaces` at `473e74b549eead71226f6c4204c945e22f4d6bd7`.
Working branch: `feature/terrevo-v32-reference-integration`.
The exact source branch SHAs and imported paths are recorded in `scripts/terrevo-v32-integration-scope.json`.

During reconciliation, PR #65 (`chore/r01-repository-consolidation`, `6e1546c33a9e08e7ba7aeff085ad05be676541ed`) was found to contain newer persistence, replay, audit, adapter and dependency work than the handoff's initial baseline. Those implementations take precedence over the older PR #64 files. Supplemental PR #64 Auth qualifier tests are retained separately. PRs #60–#63 provide the four isolated UI packages. No stale branch was blindly merged and no existing PR was closed.

## Implemented

- Reconcile PR #65 backend/security/database/qualification work and all four isolated feature packages into one reviewable tree.
- Preserve existing schema migrations byte-for-byte, including counterpart authorization and audit attribution fixes. No database was mutated in this session.
- Retain existing npm lockfiles and clean-install CI from PR #65.
- Reject repeated provider pagination IDs before a broken range provider can return duplicate relationship records. Preserve the canonical 1,000-result bound and shared ten-second deadline.
- Reject impossible reporting dates, invalid date filters, blank record IDs and invalid kind/status pairs before counting KPIs.
- Normalize qualification run IDs before tenant creation and recovery lookup. Addresses the still-valid unresolved PR #65 review finding; includes a mixed-case recovery regression.
- Register only the exact integration branch with an explicit source-derived file allowlist. Existing engineer restrictions, designated author and same-repository checks remain. Unknown branches and unassigned paths are denied. This permits the handoff's named integration work without giving either engineer unrestricted access to the other's files.
- Add source-to-code gap mapping and a machine-readable inventory. Neither is mislabeled exhaustive field acceptance.

Allowed files: exact list in the integration scope manifest. Forbidden: unrelated runtime paths, environment secrets, production configuration, deployment settings and copied reference assets.
UI CHANGE: imported optional feature components plus report validation; no global layout/navigation change and no unverified feature mounting.
DATABASE CHANGE: existing PR #65 migrations included; no new migration authored or executed.
API CONTRACT CHANGE: existing PR #65 customer-links read endpoint and transport included; no fabricated write endpoint.
SECURITY/TENANT: existing counterpart RLS and trusted audit attribution preserved; repeated-page denial added.
OFFLINE/SYNC: existing replay protection retained; no new mobile synchronization behavior.

## Local verification

- `npm ci --ignore-scripts --no-audit --no-fund`: PASS using canonical lockfile.
- `npm run typecheck`: PASS.
- `npm test`: 126/126 PASS, including customer-links domain tests.
- `npm run test:web`: 68/68 PASS. Seven customer-link domain tests are also imported by the legacy web bridge; do not add suite counts as unique-case count.
- `npm run test:release-safety`: 33/33 PASS.
- Mobile `npm test`: 12/12 PASS. Mobile bundle/typecheck not rerun locally in this checkpoint.
- `npm run build`: PASS, including compiled API runtime check; Carbon/Sass deprecation warnings remain.
- `npm run verify:release`: 25 static contracts/tests PASS. This is not production approval.
- `npm run verify:foundation`: PASS.
- Reporting regressions were observed failing before the fix and passing after it.
- Browser execution and PostgreSQL migration/restore execution are not local passes: Chromium download returned an invalid archive; package-manager installation of PostgreSQL failed under environment permission restrictions. CI remains responsible for these gates on the exact commit.

## Review and release disposition

Manual Karpathy/Ponytail review: changes use existing implementation and no new product dependency. Review is not represented as CodeRabbit output. Existing PR #64 review threads were resolved; PR #65's still-open normalization finding was checked and fixed locally. New independent review and exact-SHA CI remain required.

WARPATH: HOLD for merge/release until exact-SHA database/browser/mobile CI and review pass. Current known product gaps also preclude production acceptance.
Rollback: abandon/revert this unmerged integration branch; there are no session database or deployment changes to undo. For a later authorized schema deployment, use the existing reviewed down migrations and backup/restore gate, not ad hoc table deletion.

## Concrete outstanding work

1. Complete all field-level requirements against code, and audit remaining old branches for unique behavior before declaring S01 closed.
2. Mount source-authorized customer relationships; implement patient-safe history and audited source access. Relationship reads are not relationship creation/approval.
3. Implement approved CLM catalog/version/region/product authority, protected binaries and idempotent session writes before mounting the new catalog UI.
4. Implement receipt manifests, protected uploads, dated expense policies and verified travel evidence before mounting workforce evidence.
5. Implement consistent row-level reporting snapshots and audited authorized exports before mounting manager reporting.
6. Complete handoff S02–S07 acceptance, all 15 S08 agents and S09 cross-module/offline/security qualification. The shared agent layer is absent from these sources.
7. Final authenticated journey, owner UAT and explicit controlled production release are S10 gates. Production remains untouched and Vercel automatic deployment remains disabled.

Historical evidence imported from PR #65 describes earlier runs by that branch's author. It is preserved for traceability and is not presented as newly executed validation of this combined tree.
