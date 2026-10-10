import type {Master} from "../../terrevo-api";
export type ApprovedSlide = {id:string;title:string;body:string};
export type ApprovedAsset = {id:string;tenantId:string;title:string;productIds:string[];category:string;status:"APPROVED"|"DRAFT"|"WITHDRAWN"|"EXPIRED";slides:ApprovedSlide[];effectiveFrom?:string;expiresAt?:string};
export type SlideVisit = {slideId:string;durationMs:number};
export type DetailingSessionDraft = {tenantId:string;assetId:string;productIds:string[];startedAt:string;endedAt:string;slideVisits:SlideVisit[];linkedVisitId?:string};
export type EDetailingViewProps = {tenantId:string;contextKey:string;authorizedForTenantId:string;assets?:ApprovedAsset[];products?:Master[];today?:string;linkedVisitId?:string;onSaveSessionDraft?:(draft:DetailingSessionDraft)=>void|Promise<void>;loading?:boolean};
export function isEligibleApprovedAsset(asset:ApprovedAsset,tenantId:string,today:string):boolean{
 return Boolean(tenantId&&asset.tenantId===tenantId&&asset.status==="APPROVED"&&
 asset.id&&asset.title.trim()&&asset.slides.length>0&&asset.slides.every(s=>s.id&&s.title.trim()&&typeof s.body==="string")&&
 (!asset.effectiveFrom||asset.effectiveFrom<=today)&&(!asset.expiresAt||asset.expiresAt>=today));
}
export function eligibleAssets(assets:ApprovedAsset[],tenantId:string,today:string):ApprovedAsset[]{
 return assets.filter(x=>isEligibleApprovedAsset(x,tenantId,today));
}
export function clampSlideIndex(index:number,size:number):number{return Math.min(Math.max(index,0),Math.max(0,size-1));}
export function createDetailingSessionDraft(tenantId:string,asset:ApprovedAsset,startedAt:string,endedAt:string,visits:SlideVisit[],linkedVisitId?:string):DetailingSessionDraft{
 return {tenantId,assetId:asset.id,productIds:[...asset.productIds],startedAt,endedAt,slideVisits:visits.filter(x=>asset.slides.some(s=>s.id===x.slideId)&&x.durationMs>=0),...(linkedVisitId?{linkedVisitId}:{})};
}

/** Stable content comparison for a single authorized asset viewing session. */
export function assetContentIdentity(asset:ApprovedAsset):string{
 return JSON.stringify({id:asset.id,tenantId:asset.tenantId,title:asset.title,productIds:asset.productIds,category:asset.category,status:asset.status,effectiveFrom:asset.effectiveFrom,expiresAt:asset.expiresAt,slides:asset.slides});
}
