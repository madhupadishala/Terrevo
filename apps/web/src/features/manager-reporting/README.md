# S14 Manager productivity and audit-ready reporting
Entry: ManagerReportingView(scope,records,loading,error,onRequestCsv). Pure scope filtering, KPI and CSV escaping helpers in model.ts.
Only source-projected tenant/territory/team/role authorized rows at or before asOf; separate planned stops/completed, unplanned pending/approved/rejected, reported NCA, submitted DCR. No extrapolated KPIs, no double counting duplicate (kind,id), no NCA counted as a doctor visit. Zero planned stops => completion N/A. Work-date filters and source provenance in ledger.
CSV helper neutralizes spreadsheet formulas; view requests server-authorized export via optional callback instead of downloading unapproved rows. Context change resets filter, no network or new APIs.
Local tests: node --experimental-strip-types --test apps/web/test/manager-reporting.model.test.ts (4 passed). Await full CI and Chat 1 integration/UAT.
