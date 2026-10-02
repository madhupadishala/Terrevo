# UAT Closure Evidence — Sprint 24

This file is the blocking human evidence ledger for Pilot Release. Automated checks are necessary but do not substitute for device/business UAT.

## Evidence rule
A manual scenario can be changed to **PASS** only when all four fields are recorded: tester, UTC date/time, tested build/commit, and evidence reference (screen recording, screenshots, or signed test note). **Blank evidence means NOT RUN.**

| ID | Scenario | Expected result | Status | Tester | UTC Date/Time | Build/Commit | Evidence |
|---|---|---|---|---|---|---|---|
| UAT-01 | Login, tenant selection, logout | Correct tenant isolation; logout clears active session | NOT RUN |  |  |  |  |
| UAT-02 | Weekly tour planning + manager approval | Only approved plan becomes executable | NOT RUN |  |  |  |  |
| UAT-03 | Start Tour | One active tour; trusted time/location evidence captured | NOT RUN |  |  |  |  |
| UAT-04 | Doctor GPS check-in / check-out | Radius policy and presence integrity behave as configured | NOT RUN |  |  |  |  |
| UAT-05 | Doctor call/DCR + samples/gifts | Call data persists; inventory evidence is server-authoritative | NOT RUN |  |  |  |  |
| UAT-06 | Chemist/stockist call + RCPA + POB/order | Visit-linked data saves once and survives refresh | NOT RUN |  |  |  |  |
| UAT-07 | Daily/weekly timesheet | Derived work evidence and submission/approval are consistent | NOT RUN |  |  |  |  |
| UAT-08 | Attendance + leave | Own/manager scopes and decisions are enforced | NOT RUN |  |  |  |  |
| UAT-09 | Expenses | Line totals, submit, and manager decision remain scoped | NOT RUN |  |  |  |  |
| UAT-10 | Joint work | Join/leave evidence is explicit and cannot be inferred from plan alone | NOT RUN |  |  |  |  |
| UAT-11 | Manager command center + analytics | Manager sees only permitted tenant/team data and selected report window | NOT RUN |  |  |  |  |
| UAT-12 | Network loss during retry-safe write | Durable queue survives restart; retries preserve the original operation identity and produce one logical effect even if delivery repeats | NOT RUN |  |  |  |  |
| UAT-13 | Network loss during GPS/time authoritative action | Action is not silently replayed; user is prompted for manual recovery | NOT RUN |  |  |  |  |
| UAT-14 | Tenant switch with queued items | No queued operation crosses user/tenant boundary | NOT RUN |  |  |  |  |
| UAT-15 | Oversized/malformed API body | Request fails closed; no mutation occurs | NOT RUN |  |  |  |  |
| UAT-16 | Security/audit evidence | Critical mutation creates immutable audit record with tenant/actor context | NOT RUN |  |  |  |  |

## Blocking closure
Pilot promotion is blocked while any UAT-01 through UAT-16 row remains **NOT RUN** or **FAIL**.

## Defect handling
Every FAIL must link to a GitHub issue/PR, identify severity, and be re-run on the exact fixed build. Do not overwrite failed evidence; append a dated retest note below the table.
