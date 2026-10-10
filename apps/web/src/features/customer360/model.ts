import type { Master } from "../../terrevo-api";
export type CustomerKind = "doctor"|"chemist"|"stockist";
export type CustomerGroups = {doctors?:Master[];chemists?:Master[];stockists?:Master[]};
export type Customer = {kind:CustomerKind;record:Master};
export type CustomerFilters = {query:string;kind:CustomerKind|"all";status:string;territory:string};
export type CustomerRelationship = {id:string;tenantId:string;sourceKind:CustomerKind;sourceId:string;targetKind:CustomerKind;targetId:string;relationship:string};
export type CustomerActivity = {tenantId:string;customerKind:CustomerKind;customerId:string;id:string;occurredAt:string;activityType:string;summary:string};
export type WorkflowRequest = {customerId:string;customerType:CustomerKind;workflow:"plan"|"field"};
export type Customer360ViewProps = {tenantId:string;authorizedForTenantId:string;contextKey:string;masters:CustomerGroups;relationships?:CustomerRelationship[];history?:CustomerActivity[];loading?:boolean;error?:string|null;onOpenWorkflow?:(request:WorkflowRequest)=>void};
export const safeText=(v:unknown):string=>typeof v==="string"||typeof v==="number"?String(v):"";
export function authorizedCustomers(groups:CustomerGroups):Customer[] {
 return (["doctor","chemist","stockist"] as const).flatMap(kind=> (groups[kind==="doctor"?"doctors":kind==="chemist"?"chemists":"stockists"]??[]).filter(v=>v.id&&v.name).map(record=>({kind,record})));
}
export function filterCustomers(rows:Customer[],f:CustomerFilters):Customer[] {
 const q=f.query.trim().toLowerCase();
 return rows.filter(({kind,record:r})=>{
 const territory=safeText(r.territoryName||r.territory||r.territoryId);
 return (f.kind==="all"||kind===f.kind)&&(!f.status||r.status===f.status)&&(!f.territory||f.territory===territory)&&(!q||[r.name,r.code,territory].some(v=>safeText(v).toLowerCase().includes(q)));
 }).sort((a,b)=>a.record.name.localeCompare(b.record.name));
}
export function visibleRelationships(tenant:string,selected:Customer,authorized:Customer[],links:CustomerRelationship[]){
 const allowed=new Set(authorized.map(x=>x.kind+":"+x.record.id));
 return links.filter(x=>x.tenantId===tenant&&x.sourceKind===selected.kind&&x.sourceId===selected.record.id&&allowed.has(x.targetKind+":"+x.targetId))
 .map(x=>({...x,target:authorized.find(y=>y.kind===x.targetKind&&y.record.id===x.targetId)!}));
}
export function visibleHistory(tenant:string,selected:Customer,events:CustomerActivity[]){
 return events.filter(x=>x.tenantId===tenant&&x.customerId===selected.record.id&&x.customerKind===selected.kind).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
}
