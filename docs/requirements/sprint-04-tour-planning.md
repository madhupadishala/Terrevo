# Sprint 4 — Tour Planning

Status: Implementation

## Requirements

- **TRV-TOURPLAN-001** — An MR with TOUR_PLAN_OWN shall create one weekly tour plan for a current/future Monday-starting week.
- **TRV-TOURPLAN-002** — A tour plan shall contain 1–7 dated days inside that week.
- **TRV-TOURPLAN-003** — Each day shall reference an active territory inside the employee's organization scope.
- **TRV-TOURPLAN-004** — Stops may reference active doctors, chemists or stockists only in the selected day's territory.
- **TRV-TOURPLAN-005** — Stop sequence and stop target shall be unique within a day.
- **TRV-TOURPLAN-006** — Saving/replacing a draft plan shall be atomic.
- **TRV-TOURPLAN-007** — A submitted plan shall not be silently edited in Sprint 4.
- **TRV-TOURPLAN-008** — Submission requires at least one stop.
- **TRV-TOURPLAN-009** — Sprint 4 statuses are DRAFT and SUBMITTED only; approval states belong to Sprint 5.

## API

- GET /v1/tour-plans
- POST /v1/tour-plans
- GET /v1/tour-plans/:id
- PUT /v1/tour-plans/:id
- POST /v1/tour-plans/:id/submit
