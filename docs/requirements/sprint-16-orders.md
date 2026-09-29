# Sprint 16 — POB / Orders

Status: CLOSED

- Order booking attaches to an open owned chemist/stockist visit.
- One order snapshot per visit contains 1–50 unique active company products and positive quantities.
- Products are revalidated against the MR division.
- Customer and product codes/names are snapshotted for history.
- Save/replace is atomic and payload-aware idempotent.
- No price, tax, discount or value is invented before a pricing contract exists.
- After checkout, the order can no longer be changed through the save RPC.
