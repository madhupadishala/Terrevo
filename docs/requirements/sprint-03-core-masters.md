# Sprint 3 — Core Masters

Status: Implementation

## Requirements

- **TRV-MST-001** — Terrevo shall maintain employee, doctor, product, chemist, stockist, sample and gift masters per tenant.
- **TRV-MST-002** — Master codes shall be unique within each tenant and master type.
- **TRV-MST-003** — Doctors, chemists and stockists shall belong to a territory.
- **TRV-MST-004** — Products, samples and gifts shall belong to a division; a sample's product shall belong to the same division.
- **TRV-MST-005** — Employee reporting managers shall be on the same organization branch and shall never cross tenants.
- **TRV-MST-006** — MASTER_VIEW shall expose only masters on the user's organization branch.
- **TRV-MST-007** — MASTER_MANAGE shall be checked before server-privileged create operations.
- **TRV-MST-008** — Managers may manage masters inside their assigned subtree; MRs remain read-only.

## Deferred intentionally

Bulk CSV import, update/retirement workflows and duplicate-merging are separate enhancements after the basic master contracts are proven.
