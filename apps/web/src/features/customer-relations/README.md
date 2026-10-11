# S09 Customer relationships and authorized history
**Entry:** CustomerRelationsView with scope, subject, authorizedCustomers, relationships, history, loading, error, onOpenSource. Pure helpers in model.ts.
Read-only approved links, permitted doctor/chemist/stockist targets, provenance and patient-safe visit chronology. Role/tenant/session/territory/subject guards run even before effects clear UI filters. History sorted by absolute timestamps, filtered by occurrence date string.
**No network, patient details, persistence, link creation or inferred relationships.** Disabled optional navigation callback is an intent only.
Tests: node --experimental-strip-types --test apps/web/test/customer-relations.model.test.ts (3 local cases passing before PR). Full GitHub CI typecheck/build/test required. Chat 1 owns mounting, live data, responsive keyboard UAT.
