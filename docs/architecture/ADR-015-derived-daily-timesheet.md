# ADR-015: Daily Timesheet Is Derived Evidence
Status: Accepted

A daily timesheet is generated when a tour execution becomes SUBMITTED.

Terrevo records only what it can prove: trusted start/submit time, total worked minutes, checked-out visit duration and call count. Until travel/meeting/admin activities have their own event sources, the remaining duration is labelled unclassified rather than guessed.

The MR reviews the generated record and may add a remark, but cannot rewrite computed fields.
