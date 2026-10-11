# S11 Controlled CLM catalog and session provenance
Entry: ClmLibraryView(scope,assets,sessions,activeVisit,loading,error,onRequestDetailing). Exports in model.ts.
IBM Carbon read-only catalog restricts tenant/product/region, displays ineligible metadata separately, and disables expired/revoked/draft content. Approved assets require approver, dates, provenance and current effective window; visit handoff requires checked-in authorized visit and matching product.
Session provenance is read-only by exact asset+version. No binary fetching, slide rendering, recording, storage operations, claims of saved data or mutation of EDetailingView. Context stamp resets selection and search.
Local tests: node --experimental-strip-types --test apps/web/test/clm-library.model.test.ts (4 passed). CI typecheck/web tests/build required; UAT requires live approved content/visit from Chat 1.
