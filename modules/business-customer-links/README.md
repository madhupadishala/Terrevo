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
- Adapter contract tests: `npm test` now includes `modules/business-customer-links/test/contract.test.ts` in shared CI.
- Final-head CI and CodeRabbit must be checked after each change.

## Integration and qualification
- Shared API integration is implemented at `GET /v1/business/customer-links/:sourceId`, with authenticated tenant middleware, server-derived grants, user-JWT reads and bounded provider deadlines.
- Supported staging Auth identities and isolated persisted synthetic customer records now exist. The MR relationship read passed through the actual API in qualification run `eng1-3809150601dc`; no real customer or clinical approval is implied.
- Counterpart authorization is enforced through canonical doctor/chemist/stockist RLS in additive migration `20261011090100_customer_link_counterpart_authorization.sql`. `database/ci/customer-link-policy-tests.sql` tests denied source, denied target, inactive target and unapproved evidence.
- Final-head CI, refreshed staging RLS qualification, product-contract review and independent release-owner acceptance remain separate gates. See the consolidated Engineer 1 release evidence for their current results.


## Bounded complete-read contract

The existing `{links}` endpoint permits at most 1,000 relationships for one source, in stable ID order, across at most six provider requests including an empty boundary probe. One 10-second overall deadline covers every page and body decode. Overflow or deadline failure rejects the read; an incomplete relationship list is never presented as complete. The shared frontend bridge and fail-closed context handling are documented in the Engineer 1 handoff. Actual read/isolation evidence and exact-source CI now exist; final product/release acceptance remains separate.
