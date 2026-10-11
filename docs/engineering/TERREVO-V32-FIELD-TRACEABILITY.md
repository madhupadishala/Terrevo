# V3.2 reference traceability — initial reconciliation

Status: IN PROGRESS. Owner instruction on 2026-10-11 takes precedence over handoff section C: implement the Terrevo handoff; the supplied 84-page field guide is functional reference only. Do not copy its branding, access codes, screenshots, wording or navigation. No reference assets are bundled in Terrevo.

This is a source-to-code gap index, not exhaustive field acceptance. Page numbers refer to the supplied reference. Unless stated otherwise, requiredness, defaults, option catalogs, retention, offline policy and exact field-to-API/table tests remain UNKNOWN until verified against the existing domain contracts and approved Terrevo policies. A module's existence is not proof of the complete browser-to-database workflow.

| Reference pages | Functional observation (paraphrased) | Canonical Terrevo area | Reconciliation / acceptance gap |
|---|---|---|---|
| 4–8 | Organization selection and authenticated access | `modules/identity`, `modules/tenant` | Existing bearer/session flow retained; do not copy the reference access code or assume OTP is a required replacement |
| 9 | Refresh assigned master data | `modules/masters`, `apps/mobile` | Sync UX and complete offline master refresh acceptance unverified |
| 10–11 | Download approved detailing material | `features/clm-library`, `features/edetailing` | Binary ACL/download/revocation/offline expiry missing from verified integration |
| 16–18 | Plan day, activity category, territory and customer selection | `modules/tour-planning`, `MonthlyPlanner` | Existing types and controlled masters remain authoritative; per-field UI trace unfinished |
| 19 | Non-call category and town in planning | `modules/nca`, `modules/tour-planning` | NCA execution exists; complete planning linkage requires verification |
| 20–22 | Coverage checks and submitted/approved plan state | `modules/tour-planning`, `modules/tour-approval` | Full-day coverage and configurable frequency rules require field-level qualification |
| 23–28 | Approved agenda, attendance and start location | `modules/tour-execution`, `modules/attendance-leave`, `modules/tour-progress` | Retain canonical approved-plan/start contracts; town semantics need confirmation |
| 29–33 | Planned and unplanned customer activity | `modules/unplanned-calls`, `modules/visit-execution` | Keep unplanned approval ledger distinct from completed planned visits |
| 34 | NCA reason and remarks | `modules/nca` | Controlled options and tenant-scoped persistence exist; field acceptance still open |
| 36–40 | Doctor/chemist/stockist linkage | `modules/business-customer-links`, `customer-links-adapter.ts` | Approved read edges and counterpart RLS exist; link creation/approval and full history are not delivered here |
| 39 | Reference linkage propagation delay | No mandated Terrevo delay | Do not introduce a 30-minute wait; return actual server state |
| 41–44 | Own/competitor brand counts and final submission | `modules/rcpa` | Verify reported-value provenance, units, linked outlet rule and post-submit immutability |
| 45–48 | Product, quantity and order confirmation | `modules/orders` | Validate configured pricing, quantities, ledger and customer-link dependency end to end |
| 49–53 | Rehearsal, detailing start/end and saved session | `features/edetailing`, `features/clm-library` | UI draft/session intent is not persisted approved-content evidence |
| 54–57 | GPS, missing location and manager-reviewed location correction | `modules/visit-execution`, `database/migrations/0020b_presence_integrity.sql` | Existing GPS exceptions retained; specific customer-location change approval needs mapping |
| 58–59 | Detailed products and distributed items | `modules/doctor-call`, `modules/inventory` | Verify session-to-call and stock movement linkage; never infer distribution |
| 60 | Individual-call remarks | `modules/doctor-call` | Existing call contract retained; exact reference field constraints not established |
| 61–63 | Joint work, co-presence and manager selection | `modules/joint-work`, `database/migrations/0020b_presence_integrity.sql` | Existing server confirmation retained; physical-device discovery is unqualified |
| 65–67 | End location, day closure and report submission | `modules/tour-submit`, `modules/timesheet-daily` | Verify persisted final report and reference end-town mapping; no auto success inference |
| 72–76 | Expense line, invoice evidence and submission prerequisites | `modules/expenses`, `features/workforce-evidence` | Receipt storage/ACL/policy versions and day-report dependency need complete contracts |
| 81–82 | Leave category, remarks and status | `modules/attendance-leave` | Existing create/read/approval flow; exact options and date requirements remain source-specific |

## Additional handoff requirements independent of the reference

- S02/S03: full synthetic Alpha/Beta organization setup through authorized admin forms, dynamic policy catalogs and controlled imports.
- S07: immutable as-of reporting projections and reauthorized exports. The imported model now rejects impossible civil dates, empty IDs and unsupported kind/status combinations.
- S08: 15 shared agents, each with its own typed contract, source evidence, policy gate and evaluation. No `modules/ai-agents` implementation was found in the reconciled sources; this delivery does not mark any agent built.
- S09/S10: real database and browser qualification, offline recovery, independent UAT and explicit manual production approval remain gates.

## Canonical feature decisions

Keep `customer360` for the current directory/workflow navigation and `customer-relations` for the additional evidence/history contract; they are not interchangeable APIs. Keep `edetailing` for rendering/session drafts and `clm-library` for controlled versioned catalog selection. Workforce evidence supplements expense operations. Row-level manager reporting supplements, rather than substitutes for, existing aggregate analytics. New feature packages remain unmounted until their backend facts can be supplied truthfully.
