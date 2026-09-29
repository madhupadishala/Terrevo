# Vercel deployment

## Purpose

TRV-DEPLOY-001 exposes the existing Terrevo runtime without changing Sprint 1–20 business logic.

## Web

- Source: `apps/web`
- Build: `npm run build`
- Output: `apps/web/dist`
- Vercel project root: repository root

The current web UI is intentionally a deployment-verification shell. Product workflow screens remain separate future UI work.

## API

- Vercel entry: `api/[...path].ts`
- Public API prefix: `/api`
- Existing internal handler paths are preserved after the adapter removes the `/api` prefix.
- Health: `GET /api/health`

## Environment variables

Authenticated/business API routes require:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for privileged server mutations

The health endpoint reports only whether configuration is present. It never returns secret values.

If provider configuration is absent, business routes fail closed with HTTP 503 while the web shell and health endpoint remain available.
