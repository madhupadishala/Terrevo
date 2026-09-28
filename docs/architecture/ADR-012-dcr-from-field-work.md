# ADR-012: DCR Is Generated From Field Work
Status: Accepted

The MR records the doctor interaction once, while the visit is open. A doctor visit cannot check out without call details. Checkout and DCR creation occur in one database transaction.

The DCR is a submitted snapshot, not an editable copy of current master data. Doctor and product names/codes are snapshotted so later master changes do not rewrite historical safety/commercial documentation.

Corrections/amendments are deliberately deferred to a controlled amendment workflow; submitted DCR rows are not silently overwritten.
