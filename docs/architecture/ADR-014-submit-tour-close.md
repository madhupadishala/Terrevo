# ADR-014: Submit Tour Closes the Working Day
Status: Accepted

There is no separate End My Tour action. Submit Tour is the single normal close transition.

The server computes worked minutes from the trusted start timestamp. Open visits, unresolved/rejected GPS exceptions and missing doctor DCRs block closure. Short days are allowed only with a recorded reason.

Submission is idempotent and changes execution status from ACTIVE to SUBMITTED. Existing visit, call and distribution mutations already require an ACTIVE execution, so closure forms a hard field-work boundary.
