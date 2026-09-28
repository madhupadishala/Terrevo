# ADR-001: Modular Monolith First
Status: Accepted

Terrevo starts as a modular monolith with strict domain ownership, not microservices.

Primary domains: identity, organization, masters, tour-planning, tour-execution, visits, DCR, timesheet,
samples, RCPA, orders, expenses, leave, approvals, audit, notifications and analytics.

Modules communicate through commands, queries, events and contracts instead of mutating another module's internals.

This minimizes operational complexity while preserving boundaries that can later be extracted if scale justifies it.
