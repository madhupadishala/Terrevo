# ADR-002: Zero-Cost Pilot Architecture
Status: Accepted

Development, QA, UAT and controlled pilot default to zero paid infrastructure where technically acceptable.

Planned stack:
- Mobile: React Native + Expo + TypeScript
- Mobile local data: SQLite
- Web manager/admin: React + Vite + TypeScript
- API: portable TypeScript HTTP/domain layer; initial zero-cost deployment may use Cloudflare Workers
- Database: PostgreSQL + PostGIS; initial zero-cost provider may be Supabase Free
- Authentication: provider adapter; pilot may use Supabase Auth
- Push: Firebase Cloud Messaging
- CI: GitHub Actions free allocation
- Geofence distance: coordinates/PostGIS; no paid maps required

Business/domain code must not import provider-specific SDKs directly; adapters isolate providers.

Zero-cost tiers are for development/pilot, not an enterprise SLA promise.
