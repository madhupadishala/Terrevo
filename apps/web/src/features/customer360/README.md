# Customer 360
Read-only Carbon UI with authorized customer search, profile, explicit links and history. Exports Customer360View and typed model functions. Parent must supply authorized Master[] from the existing API, tenantId, authorizedForTenantId and contextKey. No fetches or writes. Niti guide field mapping unverified.
Validation commands required on a checkout with installed dependencies: npm run typecheck:web; npm run build:web; npm run test:web. Not yet run here.

## Guide verification (84-page Salesforce / Niti-SFA guide)
Guide pp. 35–40 describes doctor-to-chemist and chemist-to-stockist outlet linking. This package displays only explicit authorized relationships; it does not create or infer links. Backend master/link contracts and field-level mapping remain Chat 1 work.

## Initial CI evidence (before latest workflow alignment)
GitHub CI #458 foundation PASSED: npm run verify:foundation, npm run typecheck, npm test (93/93), npm run test:web (12/12), npm run build, git diff --check. Database and mobile checks also passed. Follow-up PR CI must qualify the current commit. No production deployment.
