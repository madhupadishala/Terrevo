# R04-B — Customer relationship persistence qualification

## Scope and ownership
Track B contains the isolated domain service, user-JWT PostgREST reader, schema proposal and SQL/security regression tests. Do not integrate by editing Engineer 1-owned `apps/api/src/handler.ts` or `apps/api/src/supabase-adapter.ts` without the reviewed common API contract.

## Authenticated adapter integration requirements
1. The platform middleware must authenticate the bearer JWT, verify active tenant membership and resolve server-trusted user ID, tenant ID and allowed territories.
2. Construct `BusinessContext` from that server-trusted result, never from client tenant, user, role or territory claims.
3. Call the domain service, use the caller JWT for PostgREST, enforce response body and timeout limits, and map failures to structured API errors.
4. Define a typed, versioned endpoint. Document paging semantics, relationship provenance and customer identifier normalization.
5. Verify counterpart customer authorization and relationships before exposing any data. No service-role key is permitted in the browser.
6. Integrate authoritative approved customer metadata and history in the subsequent R07 business journey, without creating competing modules.

## Tests and evidence
- Forward and rollback migration: `database/migrations/20261011090000_business_customer_links.sql` and matching `.down.sql`.
- Policy assertions: `modules/business-customer-links/sql/qualification.sql`.
- Rollback-only positive/negative isolation: `modules/business-customer-links/sql/transaction-isolation.sql`; successfully exercised against isolated Terrevo-Staging, 2026-10-11; after rollback its tenants, grants and links remained zero.
- Adapter contract tests: `node --experimental-strip-types --test modules/business-customer-links/test/contract.test.ts`. Note: this command is not currently invoked by the shared CI workflow; independent execution/CI integration is required for release acceptance.
- Final-head CI and CodeRabbit must be checked after each change.

## Gates not yet satisfied
- Real authenticated staging identities and persisted customer records (staging currently has no tenants or active memberships).
- Shared API handler integration and tested product contract.
- Backup/restore and migration-recovery evidence, cross-module UAT and independent release-owner approval.
- Verified persistence after refresh/re-login and real user RLS checks.
None of these may be represented as already passed from transaction-only test evidence.
