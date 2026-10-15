# Terrevo local synthetic demo (development only)

This is an intentionally **offline, in-memory** product demonstration. It does not read or write Supabase, Vercel or the actual backend. It does not impersonate authenticated users.

## Run locally (no deployment)

From the repository root on Node.js 22+:

```bash
npm install --ignore-scripts --no-audit --no-fund
npx vite --config apps/web/vite.config.ts --host 127.0.0.1
```

Open `http://127.0.0.1:5173/demo`. This route is enabled only when Vite's `import.meta.env.DEV` is true. Preview/production builds continue to show the regular authenticated application. No public, production or staging API key is needed.

## Scenario

1. Select synthetic pharma company A or B; confirm each has its own employees, customers, territories and product master.
2. In **Superuser**, create an additional synthetic client, territory, manager, reporting employee, and doctors/chemists/stockists/products.
3. Switch to **Employee** and submit a planned doctor visit. The employee may submit only their own plan.
4. Switch to **Manager** and approve that submitted visit. Managers may review only their reporting employees.
5. Switch back to **Employee** and complete the approved visit.
6. Switch clients; ensure customer/visit records never appear across organizations.
7. Refresh the browser and confirm demo data resets. Nothing is persisted or sent to server.

For existing tenant-admin workflows in the real application, use **Organization admin** to configure complete company → division → zone → region → area → territory hierarchy, employees and master data. Real authorization is deliberately still enforced on that path.

## Verification

```bash
npm run typecheck:web
npm run test:web
npm run build:web
```

The tests cover synthetic reference integrity, cross-client rejection, administrator-only data setup, role-specific visit transitions and reporting-manager approvals.

## Not yet accepted

This demo is not proof of backend case persistence, final multi-tenant login, JWT refresh, or live field-device acceptance. Final integration must connect and qualify the real API, unchanged server authorization, GPS/evidence workflows and controlled production release.
