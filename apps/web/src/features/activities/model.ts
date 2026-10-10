import type {Master} from "../../terrevo-api";
export type ActivityKind = "PLANNED_CALL"|"UNPLANNED_CALL"|"NON_CALL_ACTIVITY";
export type ActivityCustomerKind = "doctor"|"chemist"|"stockist";
export type ActivityEvidence = {name:string;mimeType:string;sizeBytes:number;reference?:string};
export type ActivityDraft = {kind:ActivityKind;tenantId:string;workDate:string;territoryId:string;reason:string;durationMinutes:number;remarks:string;
 ncaPhase?:"PLAN"|"REPORT";townId?:string;plannedStopId?:string;customerType?:ActivityCustomerKind;customerId?:string;ncaSubtype?:string;evidence?:ActivityEvidence};
export type TerritoryOption = {id:string;name:string};
export type PlannedCallOption = {planStopId:string;label:string;territoryId:string;workDate:string};
export type NcaSubtype = {code:string;label:string};
export type ActivitiesViewProps = {tenantId:string;authorizedForTenantId:string;contextKey:string;territories:TerritoryOption[];
 customers?:{doctors?:Master[];chemists?:Master[];stockists?:Master[]};plannedCalls?:PlannedCallOption[];
 ncaSubtypes?:NcaSubtype[];towns?:TerritoryOption[];onSaveDraft?:(draft:ActivityDraft)=>void|Promise<void>;loading?:boolean};
export type ActivityValidationContext = {territories:TerritoryOption[];customers:NonNullable<ActivitiesViewProps["customers"]>;plannedCalls:PlannedCallOption[];ncaSubtypes:NcaSubtype[];towns?:TerritoryOption[]};
export function validateActivityDraft(d:ActivityDraft,ctx:ActivityValidationContext):string[]{
 const e:string[]=[];
 if(!d.tenantId)e.push("An authorized tenant is required.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.workDate)||Number.isNaN(Date.parse(d.workDate+"T00:00:00"))||new Date(d.workDate+"T00:00:00").toISOString().slice(0,10)!==d.workDate)e.push("A valid activity date is required.");
 if(!ctx.territories.some(t=>t.id===d.territoryId))e.push("Select an authorized territory.");
 if(!Number.isInteger(d.durationMinutes)||d.durationMinutes<1||d.durationMinutes>1440)e.push("Duration must be 1–1440 minutes.");
 if(!d.reason.trim()||d.reason.trim().length>500)e.push("Reason is required (max 500 characters).");
 if(d.remarks.length>2000)e.push("Remarks exceed 2000 characters.");
 if(d.evidence&&(!d.evidence.name.trim()||d.evidence.name.length>255||d.evidence.sizeBytes<0||!Number.isFinite(d.evidence.sizeBytes)))e.push("Evidence metadata is invalid.");
 if(d.kind==="PLANNED_CALL"){
   if(!d.plannedStopId||!ctx.plannedCalls.some(x=>x.planStopId===d.plannedStopId&&x.territoryId===d.territoryId&&x.workDate===d.workDate))e.push("Select a planned stop for this date and territory.");
   if(d.ncaSubtype||d.customerId||d.customerType)e.push("Planned call cannot also be NCA or unplanned.");
 }else if(d.kind==="UNPLANNED_CALL"){
   const group=d.customerType==="doctor"?"doctors":d.customerType==="chemist"?"chemists":d.customerType==="stockist"?"stockists":null;
   if(!group||!ctx.customers[group]?.some(x=>x.id===d.customerId))e.push("Select an authorized customer.");
   if(d.plannedStopId||d.ncaSubtype)e.push("Unplanned call cannot have a planned stop or NCA subtype.");
 }else if(d.kind==="NON_CALL_ACTIVITY"){
   if(!d.ncaSubtype||!ctx.ncaSubtypes.some(x=>x.code===d.ncaSubtype))e.push("Select an approved NCA category.");
   if(d.ncaPhase!=="PLAN"&&d.ncaPhase!=="REPORT")e.push("Choose NCA planning or reporting.");
   if(d.ncaPhase==="PLAN"&&(!d.townId||!ctx.towns?.some(x=>x.id===d.townId)))e.push("Select an authorized town for planned NCA.");
   if(d.customerId||d.customerType||d.plannedStopId)e.push("Non-call activity cannot be linked as a doctor/customer call.");
 }else e.push("Activity kind is invalid.");
 return e;
}
export function emptyActivityDraft(tenantId:string,date:string):ActivityDraft{
 return {kind:"PLANNED_CALL",tenantId,workDate:date,territoryId:"",reason:"",durationMinutes:0,remarks:""};
}
