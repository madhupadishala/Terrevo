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

- Vercel entry: `api/index.js`
- Public API prefix: `/api`
- `vercel.json` rewrites every `/api/*` request to the gateway with the original path carried in an internal routing parameter.
- Existing internal handler paths are restored before the request reaches the Terrevo handler.
- Health: `GET /api/health`

## Environment variables

Authenticated/business API routes require the modern Supabase keys:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` for privileged server mutations

Legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` remain temporary fallback names only.

The health endpoint reports only whether configuration is present. It never returns secret values.

If provider configuration is absent, business routes fail closed with HTTP 503 while the web shell and health endpoint remain available.
