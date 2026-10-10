# UI Wave 1 — Terrevo operational web workspace

## Decision and scope
Replace the Vercel verification-only React page with an IBM Carbon-based operational web interface.
The UI supports an isolated browser-local tour/visit lifecycle without a sign-in screen. This is a **development workspace only**, not the authenticated, server-authoritative field execution platform.

## Architecture
- The original Expo mobile application, authenticated API handlers, Supabase adapter, RLS, tenant and RBAC services are **unchanged**.
- The web app mounts a separate React UI in `apps/web/src/App.tsx`.
- Carbon React and Sass are used for UI primitives and styling.
- `apps/web/src/workspace.ts` contains pure transition functions; activity persists only in browser local storage.
- `/api/health` is read to report deployment configuration, not to claim working business persistence.
- No Supabase secret, service role, shared dev identity or tenant token is exposed to browsers.

## What users can test
1. Open the application: overview and navigation replace the verification shell.
2. In My tours, enter a synthetic territory; start a tour.
3. In Field visits, check into a synthetic account.
4. Add a non-sensitive note, save, then check out.
5. Return to My tours and submit the tour.
6. Refresh the page: locally recorded timeline and totals persist.
7. View Activity intelligence; counts derive from actual local state.
8. View Connections & safety to inspect the health response and data boundary.
9. Attempt another active tour or submit an open visit: action must be blocked.

## Explicit limitations
- No GPS attestation, server-side audit, database persistence, real HCP records, sync, approvals or tenant/user identity in the web local-workspace mode.
- Existing mobile/API services are the production-domain source of truth.
- A future web integration must use a server-authorized session or controlled authenticated gateway, with RBAC/tenant isolation and RLS. A shared public bearer token or unauthenticated mutation route is prohibited.
- Publishing the local-only UI does **not** qualify a field-force production release.

## Automated evidence
`npm run test:web` executes pure lifecycle and storage guard tests.
`npm run typecheck:web`, `npm run build:web` and existing repository CI must pass.
Browser acceptance and CodeRabbit review must be completed against the exact deployed commit.
