# TXF 04 — Manager Command

Status: ACTIVE

- **TRV-TXF-026** — Manager Command shall be visible in the field app only when the authenticated user has MANAGER_DASHBOARD_VIEW.
- **TRV-TXF-027** — The command view shall reuse the Sprint 20 scoped operational projection; it shall not create a broader manager bypass.
- **TRV-TXF-028** — Team counts, active/submitted tours, short days, joint work and bounded pending queues shall be shown without fabricating analytics.
- **TRV-TXF-029** — Manager Command remains read-only; approval decisions stay within the existing permission-specific workflows.
- **TRV-TXF-030** — Plan-vs-actual, coverage, inventory, RCPA/order analytics and historical trend analysis are explicitly deferred to Sprint 21 analytics rather than added to the operational projection.
- **TRV-TXF-031** — Non-manager field users shall not call or render the manager command projection after access context is resolved.
- **TRV-TXF-032** — No database, RBAC policy or manager-command backend contract change is introduced.
