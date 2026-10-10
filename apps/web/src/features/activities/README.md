# Activities draft UI
Carbon forms for PLANNED_CALL, UNPLANNED_CALL and NON_CALL_ACTIVITY. Only typed onSaveDraft callback; absent callback disables handoff. No API writes, file upload, location capture or fake persisted NCA. Inputs are provided from authorized parent. Niti guide exact categories unverified. Commands to run with dependencies: npm run typecheck:web; npm run build:web; npm run test:web. Not yet run here.

## Guide verification (84-page Salesforce / Niti-SFA guide)
Guide pp. 17–19 distinguishes FW versus NCA in monthly planning, with NCA type and town. Guide pp. 29–34 distinguishes planned, unplanned and NCA reporting, with NCA reason and remarks. This package now captures PLAN/REPORT distinction and requires town only for planned NCA. Definitive NCA reason vs type taxonomies and persistence remain backend dependencies.

## Initial CI evidence (before latest workflow alignment)
GitHub CI #459 foundation PASSED: npm run verify:foundation, npm run typecheck, npm test (93/93), npm run test:web (13/13), npm run build, git diff --check. Database and mobile checks also passed. Follow-up PR CI must qualify the current commit. No production deployment.
