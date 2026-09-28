# ADR-010: Read-Only Active Tour Projection
Status: Accepted

Show My Tour is a read model, not a workflow owner. It derives elapsed time and planned-stop state from authoritative execution and plan data. It does not update execution, visits, DCRs or masters.

The database supplies serverNow so clients cannot influence elapsed-work calculations.
