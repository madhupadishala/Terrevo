# Controlled E-detailing / CLM
Exports EDetailingView and typed ApprovedAsset, DetailingSessionDraft, eligibility helpers. Approved asset library only; content supplied via authorized props, no promotional samples or images bundled. In-memory slide engagement only, no automatic write. Accurate session recording requires a future approved API. Niti guide content field-level verification pending.
Checks to run in a checkout with dependencies: npm run typecheck:web; npm run build:web; npm run test:web. Not yet executed.

## Guide verification (84-page Salesforce / Niti-SFA guide)
Guide pp. 9–11 requires controlled CLM/VA content updates, and pp. 49–53 separates rehearsal, detailing, explicit session end and save. This component implements separate rehearsal/detailing, an explicit end gate and reviewed local session draft; no approved content sync or recording endpoint is claimed.

## Initial CI evidence (before latest workflow alignment)
GitHub CI #460 foundation PASSED: npm run verify:foundation, npm run typecheck, npm test (93/93), npm run test:web (12/12), npm run build, git diff --check. Database and mobile checks also passed. Follow-up PR CI must qualify the current commit. No production deployment.
