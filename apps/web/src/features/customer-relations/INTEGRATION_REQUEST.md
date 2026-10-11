# S09 Chat 1 integration request
No verified relationship/history endpoint. No routes are consumed; do not fake persisted or source records.
Parent must pass source-authorized scope={tenantId,authorizedForTenantId,contextKey,role,permittedTerritoryIds,mayViewHistory,mayOpenSource}, subject={tenantId,kind,id,name,territoryId}, authorizedCustomers, relationships, patientSafe visit summaries, loading/error.
Required read contracts: tenant+actor+territory scoped approved relationships with source,target, evidenceId/type, verifiedAt, immutable audit provenance; authorized history summaries with tenant/customer kind/id, territory, occurredAt, patientSafe attestation, provenanceId. Define local date calendar, pagination, redaction, retention.
Optional onOpenSource({tenantId,contextKey,sourceId,sourceType}) is a navigation request. Reauthorize and audit source access at the backend; never trust client role booleans. Parent must cancel/drop stale async data when session/role/tenant/subject changes; remount by contextKey. No write/API, uploads or save claims.
UAT: role denial, target visibility, offset chronology, no sensitive patient data, mobile and keyboard.
