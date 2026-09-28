# ADR-005: Standard Roles with Organization Scope
Status: Accepted

## Decision

Sprint 2 uses TENANT_ADMIN, MANAGER and MR. MANAGER/MR assignments carry an organization scope; TENANT_ADMIN is tenant-wide.

Permission evaluation occurs in PostgreSQL against the authenticated JWT. A MANAGER assigned to a region automatically covers descendant areas and territories.

Write APIs check permission with the user's JWT first. Only after authorization succeeds may the server use its privileged provider key for the write.

## Bootstrap

The first TENANT_ADMIN assignment is a trusted provisioning action outside end-user APIs.

## Why

This provides strong tenant/scope isolation without a premature custom role-builder or duplicated manager roles for each hierarchy level.
