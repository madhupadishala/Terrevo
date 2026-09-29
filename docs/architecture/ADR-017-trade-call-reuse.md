# ADR-017: Trade Calls Reuse Visit Execution
Status: Accepted

Chemist and stockist calls do not get a second check-in/out engine. They attach business data to the existing field visit.

A database status-transition guard requires trade-call data before checkout. This avoids redefining the complex Sprint 10 checkout function and keeps doctor DCR/inventory behavior isolated.
