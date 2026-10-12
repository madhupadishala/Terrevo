import type {CustomerLink,ClmAsset,Master,WorkforceEvidencePayload} from "./terrevo-api.ts";
import type {CustomerRef,RelationshipEvidence,VisitSummary} from "./features/customer-relations/model.ts";
import type {CatalogAsset,SessionSummary} from "./features/clm-library/model.ts";
import type {Claim,ReceiptManifest,TravelEvidence,AttendanceEvidence,PolicyLimit} from "./features/workforce-evidence/model.ts";

export function authorizedCustomerRefs(tenantId:string,masters:Record<string,Master[]>):CustomerRef[]{
 const rows:Array<[CustomerRef["kind"],Master[]]>=[["doctor",masters.doctors??[]],["chemist",masters.chemists??[]],["stockist",masters.stockists??[]]];
 return rows.flatMap(([kind,items])=>items.flatMap(record=>
   record.status==="active"&&typeof record.territoryId==="string"&&record.territoryId
     ?[{tenantId,kind,id:record.id,name:record.name,territoryId:String(record.territoryId)}]:[]));
}

export function relationshipEvidence(tenantId:string,source:CustomerRef|null,links:readonly CustomerLink[]):RelationshipEvidence[]{
 if(!source)return[];
 return links.flatMap(link=>{
   if(link.tenantId!==tenantId||link.sourceId!==source.id||link.approval!=="APPROVED"||!link.evidenceId||!Number.isFinite(Date.parse(link.verifiedAt)))return[];
   return [{id:link.id,tenantId,source:{kind:source.kind,id:source.id},target:{kind:"chemist" as const,id:link.targetId},
     relation:link.relation,approval:"APPROVED" as const,evidenceId:link.evidenceId,evidenceType:"TERREVO_LINK",verifiedAt:link.verifiedAt}];
 });
}

/** Resolve target kinds only from the current authorized customer set; ambiguous IDs are rejected. */
export function relationshipEvidenceWithTargets(tenantId:string,source:CustomerRef|null,customers:CustomerRef[],links:readonly CustomerLink[]):RelationshipEvidence[]{
 if(!source)return[];
 const kinds=new Map<string,CustomerRef["kind"][]>();
 for(const c of customers)kinds.set(c.id,[...(kinds.get(c.id)??[]),c.kind]);
 return links.flatMap(link=>{
   const targetKinds=kinds.get(link.targetId);
   if(link.tenantId!==tenantId||link.sourceId!==source.id||link.approval!=="APPROVED"||!link.evidenceId||
      !Number.isFinite(Date.parse(link.verifiedAt))||targetKinds?.length!==1)return[];
   return [{id:link.id,tenantId,source:{kind:source.kind,id:source.id},target:{kind:targetKinds[0],id:link.targetId},
     relation:link.relation,approval:"APPROVED" as const,evidenceId:link.evidenceId,evidenceType:"TERREVO_LINK",verifiedAt:link.verifiedAt}];
 });
}

export function patientSafeHistory(tenantId:string,territoryId:string,rows:Array<{tenantId:string;customerKind:"doctor"|"chemist"|"stockist";customerId:string;id:string;occurredAt:string;activityType:string;summary:string}>):VisitSummary[]{
 return rows.flatMap(row=>row.tenantId===tenantId&&Number.isFinite(Date.parse(row.occurredAt))?[{
   id:row.id,tenantId,customerKind:row.customerKind,customerId:row.customerId,territoryId,occurredAt:row.occurredAt,
   visitType:row.activityType,summary:row.summary,provenanceId:row.id,patientSafe:true,
 }]:[]);
}

export function clmCatalog(assets:ClmAsset[]):CatalogAsset[]{
 return assets.flatMap(asset=>{
   if(!asset.effectiveFrom||!asset.expiresAt||!asset.approvedAt||!asset.provenanceId)return[];
   const status:CatalogAsset["status"]=asset.status==="WITHDRAWN"?"REVOKED":asset.status;
   return asset.productIds.flatMap(productId=>asset.regionCodes.map(regionCode=>({
     id:asset.id,tenantId:asset.tenantId,productId,regionCode,title:asset.title,contentType:asset.contentType,version:asset.version,
     status,approvedBy:asset.approvedBy,approvedAt:asset.approvedAt,effectiveFrom:asset.effectiveFrom!,expiresAt:asset.expiresAt!,provenanceId:asset.provenanceId,
   })));
 });
}

export function clmSessionSummaries(tenantId:string,assets:ClmAsset[],rows:Array<{id:string;asset_id:string;visit_id:string;started_at:string;ended_at:string;provenance_id:string}>):SessionSummary[]{
 const versions=new Map(assets.map(a=>[a.id,a.version]));
 return rows.flatMap(row=>{
   const version=versions.get(row.asset_id),occurredAt=row.ended_at||row.started_at;
   return version&&row.provenance_id&&Number.isFinite(Date.parse(occurredAt))?[{
     id:row.id,tenantId,assetId:row.asset_id,assetVersion:version,visitId:row.visit_id,occurredAt,status:"RECORDED" as const,provenanceId:row.provenance_id,
   }]:[];
 });
}

const claimStatuses=new Set(["DRAFT","SUBMITTED","APPROVED","REJECTED","RETURNED"]);
export function workforceEvidenceModels(payload:WorkforceEvidencePayload){
 const claims:Claim[]=payload.claims.flatMap(c=>{
   if(!claimStatuses.has(c.status)||!Number.isFinite(c.totalAmount))return[];
   return [{id:c.id,tenantId:c.tenantId??"",ownerUserId:c.ownerUserId,workDate:c.workDate,currency:c.currencyCode,
     serverTotalMinor:Math.round(c.totalAmount*100),status:c.status as Claim["status"],sourceId:c.id,asOf:payload.asOf,
     lines:c.lines.flatMap(line=>Number.isFinite(line.amount)?[{id:`${c.id}:${line.sequence}`,category:line.category,amountMinor:Math.round(line.amount*100),receiptRequired:Boolean(line.receiptReference)}]:[])}];
 });
 const receipts:ReceiptManifest[]=payload.receipts.flatMap(r=>
   ["VERIFIED","PENDING","MISSING","REVOKED"].includes(r.status)?[{...r,status:r.status as ReceiptManifest["status"]}]:[]);
 const travel:TravelEvidence[]=payload.travel.flatMap(t=>
   ["SERVER_GPS","SERVER_ROUTE","UNVERIFIED"].includes(t.method)&&Number.isFinite(t.distanceMeters)&&t.distanceMeters>=0?[{...t,method:t.method as TravelEvidence["method"]}]:[]);
 const attendance:AttendanceEvidence[]=payload.attendance.flatMap(a=>
   ["PRESENT","LEAVE","ABSENT","PENDING"].includes(a.state)?[{...a,state:a.state as AttendanceEvidence["state"]}]:[]);
 const policies:PolicyLimit[]=payload.policies.filter(p=>Number.isSafeInteger(p.maxMinor)&&p.maxMinor>=0);
 return {claims,receipts,travel,attendance,policies};
}
