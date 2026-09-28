# ADR-004: Managed Identity and Stateless Tenant Context
Status: Accepted

## Decision

For the zero-cost pilot, Supabase Auth owns passwords, password reset and access/refresh tokens. Terrevo does not implement a custom password store or session table.

Terrevo's API validates the bearer token through the identity-provider adapter. Tenant selection is stateless: a tenant-scoped request carries `X-Tenant-Id`, and the server verifies access before returning a tenant context.

Tenant visibility is additionally enforced in PostgreSQL with row-level security.

## Why

Building credential storage and session cryptography ourselves adds security risk without creating product differentiation. Stateless tenant context avoids hidden server session state and makes mobile/offline/API behavior easier to reason about.

## Portability

Provider-specific calls live only in the Supabase adapter. Identity and tenant domain modules remain provider-agnostic so a later enterprise identity provider can replace Supabase without rewriting business modules.
