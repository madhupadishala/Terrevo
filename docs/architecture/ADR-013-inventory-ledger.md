# ADR-013: Immutable Inventory Ledger
Status: Accepted

Sample/gift stock is never represented only by an editable quantity. Each balance change is produced by an idempotent inventory operation and an immutable ledger row.

Employee rows are locked during stock operations, serializing concurrent issue/return/distribution for one MR. Distribution locks the visit as well, preventing checkout from racing ahead of sample/gift recording.

A doctor DCR snapshots visit distributions during the same transactional checkout that creates the DCR.
