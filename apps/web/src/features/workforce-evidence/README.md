# S13 Workforce expense, receipt and attendance evidence
Entry: WorkforceEvidenceView(scope,claims,receipts,travel,attendance,policies,loading,error,onRequestReceiptReview). Typed model with no backend requests.
Read-only source records: monetary amounts use integer minor units; compare authoritative amount with recomputed line sum; show missing verified receipts, dated/currency-approved policy violations, travel source/method, attendance state and day closure. No GPS collection, OCR, signed links, upload, claim approval or fake settlement.
FIELD sees only own claims; MANAGER/ADMIN need explicit permittedUserIds. Exact tenant checks for expenses, receipts, travel, policies, attendance. Context change resets inspected claim. Parent handles aborting stale network results and server authorization.
Local tests: node --experimental-strip-types --test apps/web/test/workforce-evidence.model.test.ts (4 passed). Full CI and UAT required.
