# ADR-019: Quantity-Only POB Until Pricing Exists
Status: Accepted

Terrevo records product and quantity order booking against an open chemist/stockist visit. Commercial value is deliberately absent until a governed price/discount/tax source exists. Customer/product identity is snapshotted and retries are payload-aware idempotent.
