# TXF Standard — Terrevo Cross-Technology Field Standard

Version: 1.0

TXF is Terrevo's internal field-product standard. It combines proven field-force workflow patterns, low-friction MR usability, enterprise transaction discipline, and Terrevo-specific presence integrity. External products are directional benchmarks only; TXF does not copy their UI, source code, or proprietary behavior.

## Benchmark intent

- Indian pharma field practicality: NITI SFA / SANeForce style coverage of tour, doctor, chemist, stockist and field reporting.
- MR usability: Phyzii-style call-by-call simplicity and low duplicate entry.
- Transaction/compliance discipline: Veeva-style controlled call, sample and audit records.
- Enterprise architecture: Salesforce-style tenant, authorization and durable workflow boundaries.
- Terrevo differentiation: server-derived presence integrity, privacy-bounded GPS, retry-safe writes and evidence-derived reporting.

## TXF rules

1. **One field action, one source of truth.** Do not ask the MR to re-enter data already proven by a trusted field action.
2. **Server authority.** Server time, tenant scope, authorization, inventory, final status and compliance records remain authoritative.
3. **Next-action-first UX.** The mobile experience should make the next valid field action obvious and keep secondary reporting out of the way.
4. **Derived reporting.** Attendance, DCRs and timesheets should be generated from trusted execution evidence wherever possible.
5. **Transaction integrity.** Critical writes are atomic/idempotent; retry, replay or double-tap must not duplicate business records.
6. **Evidence + explicit exceptions.** GPS or workflow exceptions are recorded and reviewed, never silently converted into verified activity.
7. **Resumable field reliability.** App restart, reconnect and uncertain network responses must preserve recoverable critical state.
8. **Inventory truth.** MR sample/gift balances come from the authoritative ledger; the UI may preview a projected post-call balance but never mutate inventory locally.
9. **Privacy-bounded presence.** Capture only the location evidence required around explicit field actions; no continuous tracking by default.
10. **Compatibility before cleverness.** Reuse established contracts and preserve supported-client behavior unless a requirement explicitly changes them.

## Mandatory engineering gates

Every TXF change uses all four Terrevo build principles:

- Karpathy guidelines: think first, smallest verifiable change.
- Ponytail: reuse before adding; no speculative abstractions/dependencies.
- Warpath: adversarial pre-merge safety and field-reliability gate.
- Code review: CodeRabbit when an actual review is available; otherwise independent review and CI, with no false PASS claim.
