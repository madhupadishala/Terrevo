# TXF 02 — Trade Execution

Status: ACTIVE

- **TRV-TXF-010** — Chemist and stockist mobile calls shall use the same GPS visit lifecycle and presence-integrity controls as doctor visits.
- **TRV-TXF-011** — Chemist/stockist call outcome is mandatory before checkout; remarks and next action remain optional.
- **TRV-TXF-012** — Chemist RCPA shall accept only explicit observed company-product or competitor quantities and shall never fabricate zero-to-positive observations.
- **TRV-TXF-013** — Chemist/stockist POB orders shall contain only selected active company products and positive whole-number quantities; price, tax and discount remain outside scope.
- **TRV-TXF-014** — Trade call, RCPA and order writes shall reuse persisted operation IDs so reconnect/retry cannot duplicate or corrupt business records.
- **TRV-TXF-015** — Optional RCPA/order evidence entered during an open visit shall be saved before checkout; checkout shall not proceed after an uncertain critical write.
- **TRV-TXF-016** — Existing doctor/DCR, inventory, GPS exception, tenant isolation and presence behavior shall remain unchanged.
- **TRV-TXF-017** — Trade execution shall remain a single field journey; no duplicate end-of-day re-entry is introduced.
