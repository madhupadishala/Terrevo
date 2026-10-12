export type CustomerType = "doctor" | "chemist" | "stockist";
export type CustomerRef = { tenantId:string; kind:CustomerType; id:string; name:string; territoryId:string };
export type RelationshipEvidence = { id:string; tenantId:string; source:Pick<CustomerRef,"kind"|"id">; target:Pick<CustomerRef,"kind"|"id">; relation:string; approval:"APPROVED"|"PENDING"|"REJECTED"; evidenceId:string; evidenceType:string; verifiedAt:string };
export type VisitSummary = { id:string; tenantId:string; customerKind:CustomerType; customerId:string; territoryId:string; occurredAt:string; visitType:string; summary:string; provenanceId:string; patientSafe:boolean };
export type ViewerScope = { tenantId:string; authorizedForTenantId:string; contextKey:string; role:"FIELD"|"MANAGER"|"ADMIN"; permittedTerritoryIds:string[]; mayViewHistory:boolean; mayOpenSource:boolean };
export type RelationshipRow = RelationshipEvidence & { targetCustomer:CustomerRef };
export type RelationshipViewProps = { scope:ViewerScope; subject:CustomerRef|null; authorizedCustomers:CustomerRef[]; relationships?:RelationshipEvidence[]; history?:VisitSummary[]; loading?:boolean; error?:string|null; onOpenSource?:(request:{tenantId:string; contextKey:string; sourceId:string; sourceType:"RELATIONSHIP"|"VISIT"})=>void };
export const isAuthorized=(s:ViewerScope)=>Boolean(s.tenantId&&s.contextKey&&s.tenantId===s.authorizedForTenantId&&s.permittedTerritoryIds.length);
export function visibleSubject(s:ViewerScope,subject:CustomerRef|null,customers:CustomerRef[]):CustomerRef|null {
 if(!isAuthorized(s)||!subject||subject.tenantId!==s.tenantId||!s.permittedTerritoryIds.includes(subject.territoryId))return null;
 return customers.find(c=>c.tenantId===s.tenantId&&c.id===subject.id&&c.kind===subject.kind&&c.territoryId===subject.territoryId)||null;
}
export function approvedLinks(s:ViewerScope,subject:CustomerRef|null,customers:CustomerRef[],links:RelationshipEvidence[]):RelationshipRow[]{
 const selected=visibleSubject(s,subject,customers);if(!selected)return [];
 const authorized=new Map(customers.filter(c=>c.tenantId===s.tenantId&&s.permittedTerritoryIds.includes(c.territoryId)).map(c=>[`${c.kind}:${c.id}`,c]));
 return links.filter(l=>l.tenantId===s.tenantId&&l.approval==="APPROVED"&&!!l.evidenceId&&Number.isFinite(Date.parse(l.verifiedAt))&&l.source.kind===selected.kind&&l.source.id===selected.id)
  .flatMap(l=>{const target=authorized.get(`${l.target.kind}:${l.target.id}`);return target?[{...l,targetCustomer:target}]:[];});
}
export function safeHistory(s:ViewerScope,subject:CustomerRef|null,customers:CustomerRef[],rows:VisitSummary[],startDate="",endDate=""):VisitSummary[]{
 const selected=visibleSubject(s,subject,customers);if(!selected||!s.mayViewHistory)return [];
 return rows.filter(r=>r.tenantId===s.tenantId&&r.patientSafe===true&&r.customerKind===selected.kind&&r.customerId===selected.id&&r.territoryId===selected.territoryId&&!!r.provenanceId&&Number.isFinite(Date.parse(r.occurredAt))&&(!startDate||r.occurredAt.slice(0,10)>=startDate)&&(!endDate||r.occurredAt.slice(0,10)<=endDate))
 .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)||a.id.localeCompare(b.id));
}
