import type { CustomerLink } from "../../../modules/business-customer-links/src/index.ts";
import type { CustomerGroups, CustomerKind, CustomerRelationship } from "./features/customer360/model.ts";

/** Map verified API edges using only the current tenant's authorized masters. */
export function customerRelationships(tenantId: string, sourceId: string, groups: CustomerGroups, links: readonly CustomerLink[]): CustomerRelationship[] {
  const kinds = new Map<string, CustomerKind[]>();
  for (const [kind, records] of [["doctor", groups.doctors], ["chemist", groups.chemists], ["stockist", groups.stockists]] as const) {
    for (const record of records ?? []) {
      if (record.status !== "active" || (record.tenantId !== undefined && record.tenantId !== tenantId)) continue;
      kinds.set(record.id, [...(kinds.get(record.id) ?? []), kind]);
    }
  }
  const source = kinds.get(sourceId);
  if (!tenantId || source?.length !== 1) return [];
  return links.flatMap(link => {
    const target = kinds.get(link.targetId);
    if (link.tenantId !== tenantId || link.sourceId !== sourceId || link.approval !== "APPROVED" ||
        !link.evidenceId.trim() || !Number.isFinite(Date.parse(link.verifiedAt)) || target?.length !== 1) return [];
    return [{id:link.id,tenantId,sourceKind:source[0],sourceId,targetKind:target[0],targetId:link.targetId,relationship:link.relation}];
  });
}
