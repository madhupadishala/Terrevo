/** Track B customer relationship persistence; caller context MUST come from authenticated tenant middleware. */
export type CustomerLink = {id:string;tenantId:string;sourceId:string;targetId:string;territoryId:string;relation:string;approval:"APPROVED"|"PENDING"|"REJECTED";evidenceId:string;verifiedAt:string};
export type BusinessContext = {tenantId:string;userId:string;accessToken:string;permittedTerritoryIds:readonly string[]};
export type CustomerLinkStore = {list(tenantId:string,accessToken:string,sourceId:string):Promise<CustomerLink[]>};
export class BusinessAccessError extends Error {}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createCustomerLinksService(store:CustomerLinkStore){
 return {async list(context:BusinessContext,sourceId:string):Promise<CustomerLink[]>{
  if(!UUID.test(context.tenantId)||!UUID.test(context.userId)||!UUID.test(sourceId)||!context.accessToken||!Array.isArray(context.permittedTerritoryIds)||!context.permittedTerritoryIds.length)throw new BusinessAccessError("Missing authenticated customer scope");
  const rows=await store.list(context.tenantId,context.accessToken,sourceId);
  // Defence in depth: the database must independently enforce RLS and row visibility.
  return rows.filter(r=>r.tenantId===context.tenantId&&r.sourceId===sourceId&&context.permittedTerritoryIds.includes(r.territoryId)&&r.approval==="APPROVED"&&!!r.evidenceId&&Number.isFinite(Date.parse(r.verifiedAt))).sort((a,b)=>a.id.localeCompare(b.id));
 }};
}
/** PostgREST adapter uses the caller JWT (not service-role credentials), preserving database RLS. */
export function createCustomerLinksPostgrest(baseUrl:string,anonKey:string,fetcher:typeof fetch=fetch):CustomerLinkStore{
 if(!/^https:\/\//.test(baseUrl)||!anonKey)throw new Error("HTTPS provider and public API key required");
 return {async list(tenantId,accessToken,sourceId){
  const url=new URL("/rest/v1/business_customer_links",baseUrl);url.searchParams.set("select","id,tenant_id,source_id,target_id,territory_id,relation,approval,evidence_id,verified_at");url.searchParams.set("tenant_id",`eq.${tenantId}`);url.searchParams.set("source_id",`eq.${sourceId}`);url.searchParams.set("limit","200");
  const res=await fetcher(url.toString(),{headers:{apikey:anonKey,authorization:`Bearer ${accessToken}`,accept:"application/json"},cache:"no-store"});
  if(!res.ok)throw new Error("Customer link provider request failed");
  const rows:unknown=await res.json();if(!Array.isArray(rows))throw new Error("Invalid customer link provider response");
  return rows.map((x:unknown)=>{if(!x||typeof x!=="object"||Array.isArray(x))throw new Error("Invalid relationship row");const r=x as Record<string,unknown>;for(const key of ["id","tenant_id","source_id","target_id","territory_id","relation","approval","evidence_id","verified_at"])if(typeof r[key]!=="string")throw new Error("Invalid relationship row");return {id:r.id as string,tenantId:r.tenant_id as string,sourceId:r.source_id as string,targetId:r.target_id as string,territoryId:r.territory_id as string,relation:r.relation as string,approval:r.approval as CustomerLink["approval"],evidenceId:r.evidence_id as string,verifiedAt:r.verified_at as string};});
 }};
}
