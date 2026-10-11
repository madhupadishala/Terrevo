export type ClmStatus="APPROVED"|"DRAFT"|"EXPIRED"|"REVOKED";
export type CatalogAsset={id:string;tenantId:string;productId:string;regionCode:string;title:string;contentType:string;version:string;status:ClmStatus;approvedBy:string;approvedAt:string;effectiveFrom:string;expiresAt:string;provenanceId:string};
export type ActiveVisit={tenantId:string;id:string;customerId:string;status:"CHECKED_IN"|"CHECKED_OUT";productIds:string[]};
export type SessionSummary={id:string;tenantId:string;assetId:string;assetVersion:string;visitId:string;occurredAt:string;status:"RECORDED"|"PENDING_REVIEW"|"REJECTED";provenanceId:string};
export type CatalogScope={tenantId:string;authorizedForTenantId:string;contextKey:string;allowedProductIds:string[];allowedRegions:string[];roleCanDetail:boolean;today:string};
export type DetailingHandoff={tenantId:string;contextKey:string;assetId:string;assetVersion:string;productId:string;regionCode:string;activeVisitId:string;provenanceId:string};
export type ClmLibraryProps={scope:CatalogScope;assets?:CatalogAsset[];sessions?:SessionSummary[];activeVisit?:ActiveVisit|null;loading?:boolean;error?:string|null;onRequestDetailing?:(intent:DetailingHandoff)=>void};
export function allowedCatalog(s:CatalogScope,assets:CatalogAsset[]):CatalogAsset[]{
 if(!s.tenantId||s.tenantId!==s.authorizedForTenantId||!s.contextKey)return [];
 const keys=new Set<string>();return assets.filter(a=>{
  if(a.tenantId!==s.tenantId||!s.allowedProductIds.includes(a.productId)||!s.allowedRegions.includes(a.regionCode)||!a.id||!a.version||!a.provenanceId)return false;
  const key=`${a.id}:${a.version}`;if(keys.has(key))return false;keys.add(key);return true;
 });
}
export function isEligible(s:CatalogScope,a:CatalogAsset):boolean{
 return a.status==="APPROVED"&&a.approvedBy.trim().length>0&&Number.isFinite(Date.parse(a.approvedAt))&&!!a.effectiveFrom&&!!a.expiresAt&&a.effectiveFrom<=s.today&&a.expiresAt>=s.today;
}
export function canDetail(s:CatalogScope,a:CatalogAsset,visit?:ActiveVisit|null):boolean{
 return s.roleCanDetail&&allowedCatalog(s,[a]).length===1&&isEligible(s,a)&&!!visit&&visit.tenantId===s.tenantId&&visit.status==="CHECKED_IN"&&visit.productIds.includes(a.productId)&&!!visit.id;
}
export function recordedSessions(s:CatalogScope,assets:CatalogAsset[],rows:SessionSummary[]):SessionSummary[]{
 const allowed=new Set(allowedCatalog(s,assets).map(a=>`${a.id}:${a.version}`));
 return rows.filter(r=>r.tenantId===s.tenantId&&allowed.has(`${r.assetId}:${r.assetVersion}`)&&!!r.provenanceId&&Number.isFinite(Date.parse(r.occurredAt))).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
}
export function detailingIntent(s:CatalogScope,a:CatalogAsset,v:ActiveVisit):DetailingHandoff|null{
 return canDetail(s,a,v)?{tenantId:s.tenantId,contextKey:s.contextKey,assetId:a.id,assetVersion:a.version,productId:a.productId,regionCode:a.regionCode,activeVisitId:v.id,provenanceId:a.provenanceId}:null;
}
