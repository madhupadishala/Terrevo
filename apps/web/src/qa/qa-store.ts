import type {ApprovalQueueItem,ClmSession,Dcr,ExpenseRecord,LeaveRecord,NcaRecord,PobOrder,QaScenario,QaState,RcpaRecord,SampleDistribution,TimesheetRecord,WorkflowStatus} from "./types.ts";
import {buildScenario} from "./qa-scenarios.ts";
import {QA_DATE} from "./qa-fixtures.ts";

export type QaAction={type:"SET_SCENARIO";scenario:QaScenario}|{type:"REPLACE";state:QaState}|{type:"RESET"};
export function qaReducer(state:QaState,action:QaAction):QaState{
 if(action.type==="SET_SCENARIO")return buildScenario(action.scenario);
 if(action.type==="RESET")return buildScenario(state.scenario);
 return action.state;
}
export function initialQaState():QaState{return buildScenario("NORMAL_DAY")}
export function activeVisit(s:QaState){return s.visits.find(v=>v.status==="CHECKED_IN")??null}
export function ensureUnlocked(s:QaState,date=QA_DATE){if(s.lockedDate===date)throw new Error("The selected day is locked after DCR submission.")}
export function checkInVisit(s:QaState,visitId:string):QaState{
 ensureUnlocked(s);
 if(activeVisit(s))throw new Error("Close the active customer visit before checking in elsewhere.");
 const target=s.visits.find(v=>v.id===visitId);if(!target)throw new Error("Visit not found.");
 if(target.status!=="PLANNED")throw new Error("Only a planned visit can be checked in.");
 return {...s,visits:s.visits.map(v=>v.id===visitId?{...v,status:"CHECKED_IN",checkinAt:QA_DATE+"T09:05:00+05:30"}:v)};
}
export function closeVisit(s:QaState,visitId:string,outcome:string):QaState{
 ensureUnlocked(s);
 const target=s.visits.find(v=>v.id===visitId);if(!target||target.status!=="CHECKED_IN")throw new Error("An active checked-in visit is required.");
 return {...s,visits:s.visits.map(v=>v.id===visitId?{...v,status:"COMPLETED",checkoutAt:QA_DATE+"T10:00:00+05:30",callOutcome:outcome}:v)};
}
export function startClm(s:QaState,assetId:string,mode:"REHEARSAL"|"DETAILING"):QaState{
 ensureUnlocked(s);
 const asset=s.clmAssets.find(a=>a.id===assetId);if(!asset)throw new Error("CLM asset not found.");
 if(asset.status!=="APPROVED")throw new Error("Only approved CLM content can be opened.");
 const visit=activeVisit(s);
 if(mode==="DETAILING"&&(!visit||visit.customerType!=="DOCTOR"))throw new Error("Detailing requires an active checked-in doctor visit.");
 const id=`clm-session-${s.clmSessions.length+1}`;
 const session:ClmSession={id,mode,assetId,visitId:mode==="DETAILING"?visit!.id:undefined,startedAt:QA_DATE+"T09:10:00+05:30",slideDwells:[]};
 return {...s,clmSessions:[...s.clmSessions,session]};
}
export function finishClm(s:QaState,sessionId:string,reaction:"POSITIVE"|"NEUTRAL"|"NEGATIVE",slideDwells:{slideId:string;durationMs:number}[]):QaState{
 ensureUnlocked(s);
 const session=s.clmSessions.find(x=>x.id===sessionId);if(!session)throw new Error("CLM session not found.");
 const ended={...session,endedAt:QA_DATE+"T09:20:00+05:30",reaction,slideDwells};
 if(session.mode==="REHEARSAL")return {...s,clmSessions:s.clmSessions.map(x=>x.id===sessionId?ended:x)};
 if(!session.visitId)throw new Error("Detailing session is not linked to a visit.");
 return {...s,clmSessions:s.clmSessions.map(x=>x.id===sessionId?ended:x),visits:s.visits.map(v=>v.id===session.visitId?{...v,clmSessionIds:[...v.clmSessionIds,sessionId]}:v)};
}
export function saveNca(s:QaState,input:Omit<NcaRecord,"id"|"status">):QaState{
 ensureUnlocked(s,input.date);
 if(activeVisit(s))throw new Error("NCA cannot overlap an active customer check-in.");
 if(input.durationMinutes<30||input.durationMinutes>600)throw new Error("NCA duration must be between 30 minutes and 10 hours.");
 if(!s.ncaCategories.some(x=>x.code===input.category&&x.active))throw new Error("Select an active NCA category.");
 const town=s.ncaTowns.find(x=>x.name===input.town&&x.active);
 if(!town||town.territoryId!==s.territory.id)throw new Error("Select an authorized town.");
 return {...s,nca:[...s.nca,{...input,id:`nca-${s.nca.length+1}`,status:"DRAFT"}]};
}
function moveStatus<T extends {id:string;status:WorkflowStatus;managerComment?:string}>(rows:T[],id:string,status:WorkflowStatus,comment?:string):T[]{
 return rows.map(x=>x.id===id?{...x,status,...(comment?{managerComment:comment}:{})}:x);
}
export function submitNca(s:QaState,id:string):QaState{return {...s,nca:moveStatus(s.nca,id,"SUBMITTED")}}
export function decideNca(s:QaState,id:string,decision:"APPROVED"|"REJECTED",comment?:string):QaState{return {...s,nca:moveStatus(s.nca,id,decision,comment)}}
export function distributeInventory(s:QaState,inventoryId:string,qty:number):QaState{
 ensureUnlocked(s);
 const visit=activeVisit(s);if(!visit||visit.customerType!=="DOCTOR")throw new Error("Distribution requires an active checked-in doctor visit.");
 if(!Number.isInteger(qty)||qty<=0)throw new Error("Quantity must be a positive whole number.");
 const item=s.inventory.find(x=>x.id===inventoryId);if(!item)throw new Error("Inventory item not found.");
 if(qty>item.availableQty)throw new Error("Quantity exceeds available inventory.");
 const id=`distribution-${s.distributions.length+1}`;const d:SampleDistribution={id,visitId:visit.id,inventoryId,quantity:qty,createdAt:QA_DATE+"T09:25:00+05:30"};
 return {...s,inventory:s.inventory.map(x=>x.id===inventoryId?{...x,availableQty:x.availableQty-qty,distributedQty:x.distributedQty+qty}:x),distributions:[...s.distributions,d],visits:s.visits.map(v=>v.id===visit.id?{...v,sampleDistributionIds:[...v.sampleDistributionIds,id]}:v)};
}
export function rcpaEligibility(s:QaState):{enabled:boolean;reason?:string}{
 const visit=activeVisit(s);if(!visit)return{enabled:false,reason:"Check in to a chemist visit."};
 if(visit.customerType!=="CHEMIST")return{enabled:false,reason:"RCPA is available only during a chemist visit."};
 if(!s.links.some(l=>l.type==="DOCTOR_CHEMIST"&&l.chemistId===visit.customerId))return{enabled:false,reason:"Map this chemist to an authorized doctor first."};
 return{enabled:true};
}
export function saveRcpa(s:QaState,input:{productId?:string;competitorBrand?:string;brandQty:number;competitorQty:number;rxCount:number}):QaState{
 ensureUnlocked(s);const eligibility=rcpaEligibility(s);if(!eligibility.enabled)throw new Error(eligibility.reason);
 if(input.brandQty<0||input.competitorQty<0||input.rxCount<0)throw new Error("RCPA quantities cannot be negative.");
 const visit=activeVisit(s)!;const denom=input.brandQty+input.competitorQty;
 const id=`rcpa-${s.rcpa.length+1}`;const row:RcpaRecord={id,visitId:visit.id,chemistId:visit.customerId,createdAt:QA_DATE+"T11:20:00+05:30",lines:[{id:id+"-1",...input,marketSharePct:denom?Math.round(input.brandQty/denom*10000)/100:0}]};
 return {...s,rcpa:[...s.rcpa,row],visits:s.visits.map(v=>v.id===visit.id?{...v,rcpaIds:[...v.rcpaIds,id]}:v)};
}
export function pobEligibility(s:QaState):{enabled:boolean;reason?:string}{
 const visit=activeVisit(s);if(!visit)return{enabled:false,reason:"Check in to a chemist or stockist visit."};
 if(visit.customerType==="DOCTOR")return{enabled:false,reason:"POB is disabled during doctor visits."};
 if(visit.customerType==="CHEMIST"&&!s.links.some(l=>l.type==="CHEMIST_STOCKIST"&&l.chemistId===visit.customerId))return{enabled:false,reason:"Map this chemist to an authorized stockist first."};
 if(visit.customerType==="STOCKIST"&&!s.links.some(l=>l.type==="CHEMIST_STOCKIST"&&l.stockistId===visit.customerId))return{enabled:false,reason:"Map this stockist to an authorized chemist first."};
 return{enabled:true};
}
export function bookPob(s:QaState,lines:{productId:string;quantity:number}[],token:string):QaState{
 ensureUnlocked(s);const eligibility=pobEligibility(s);if(!eligibility.enabled)throw new Error(eligibility.reason);
 if(!token.trim())throw new Error("Idempotency token is required.");
 if(s.pob.some(x=>x.idempotencyToken===token))return s;
 if(!lines.length||lines.some(x=>!x.productId||!Number.isInteger(x.quantity)||x.quantity<=0))throw new Error("POB cart contains an invalid line.");
 const visit=activeVisit(s)!;const id=`pob-${s.pob.length+1}`;const order:PobOrder={id,visitId:visit.id,chemistId:visit.customerType==="CHEMIST"?visit.customerId:undefined,stockistId:visit.customerType==="STOCKIST"?visit.customerId:undefined,lines,status:"BOOKED",idempotencyToken:token,createdAt:QA_DATE+"T11:30:00+05:30"};
 return {...s,pob:[...s.pob,order],visits:s.visits.map(v=>v.id===visit.id?{...v,pobIds:[...v.pobIds,id]}:v)};
}
export function requestLeave(s:QaState,input:Omit<LeaveRecord,"id"|"status">):QaState{
 const overlap=s.leaves.some(x=>x.repId===input.repId&&x.status!=="REJECTED"&&x.from<=input.to&&x.to>=input.from);if(overlap)throw new Error("Leave dates overlap an existing request.");
 return {...s,leaves:[...s.leaves,{...input,id:`leave-${s.leaves.length+1}`,status:"SUBMITTED"}]};
}
export function saveExpense(s:QaState,input:Omit<ExpenseRecord,"id"|"status">):QaState{
 ensureUnlocked(s,input.date);
 if(input.amount<=0)throw new Error("Expense amount must be greater than zero.");
 return {...s,expenses:[...s.expenses,{...input,id:`exp-${s.expenses.length+1}`,status:"DRAFT"}]};
}
export function submitExpense(s:QaState,id:string):QaState{const row=s.expenses.find(x=>x.id===id);if(!row)throw new Error("Expense not found.");ensureUnlocked(s,row.date);return{...s,expenses:moveStatus(s.expenses,id,"SUBMITTED")}}
export function submitTimesheet(s:QaState,id:string):QaState{return{...s,timesheets:moveStatus(s.timesheets,id,"SUBMITTED")}}
export function decideWorkforce(s:QaState,kind:"LEAVE"|"EXPENSE"|"TIMESHEET",id:string,decision:"APPROVED"|"REJECTED"|"RETURNED",comment?:string):QaState{
 if(kind==="LEAVE")return{...s,leaves:moveStatus(s.leaves,id,decision,comment)};
 if(kind==="EXPENSE")return{...s,expenses:moveStatus(s.expenses,id,decision,comment)};
 return{...s,timesheets:moveStatus(s.timesheets,id,decision,comment)};
}
export function buildDcr(s:QaState,repId="rep-hyd-01",date=QA_DATE):Dcr{
 const visits=s.visits.filter(v=>v.repId===repId&&v.plannedAt.slice(0,10)===date&&v.status==="COMPLETED");
 const nca=s.nca.filter(n=>n.repId===repId&&n.date===date&&n.status==="APPROVED");
 const visitIds=visits.map(v=>v.id);
 return{id:`dcr-${repId}-${date}`,repId,date,visitIds,ncaIds:nca.map(n=>n.id),
  clmSessionIds:visits.flatMap(v=>v.clmSessionIds),sampleDistributionIds:visits.flatMap(v=>v.sampleDistributionIds),
  rcpaIds:visits.flatMap(v=>v.rcpaIds),pobIds:visits.flatMap(v=>v.pobIds),status:"DRAFT",locked:false};
}
export function submitDcr(s:QaState,repId="rep-hyd-01",date=QA_DATE):QaState{
 if(s.visits.some(v=>v.repId===repId&&v.plannedAt.slice(0,10)===date&&v.status==="CHECKED_IN"))throw new Error("Close all visits before submitting DCR.");
 if(s.visits.some(v=>v.repId===repId&&v.plannedAt.slice(0,10)===date&&v.status!=="COMPLETED"))throw new Error("All planned visits must be completed before DCR submission.");
 const dcr={...buildDcr(s,repId,date),status:"SUBMITTED" as const,submittedAt:date+"T18:00:00+05:30",locked:true};
 return{...s,dcrs:[...s.dcrs.filter(x=>!(x.repId===repId&&x.date===date)),dcr],lockedDate:date};
}
export function managerMetrics(s:QaState){
 const planned=s.tourPlans.reduce((n,p)=>n+p.plannedVisitIds.length,0);
 return{teamMembers:s.reps.length,activeTours:new Set(s.visits.filter(v=>v.status==="CHECKED_IN").map(v=>v.repId)).size,submittedDays:s.dcrs.filter(d=>d.status==="SUBMITTED").length,plannedCalls:planned,completedCalls:s.visits.filter(v=>v.status==="COMPLETED").length,pendingDcrs:s.dcrs.filter(d=>d.status==="DRAFT").length,pendingTourPlans:s.tourPlans.filter(x=>x.status==="SUBMITTED").length,pendingGpsExceptions:s.gpsExceptions.filter(x=>x.status==="SUBMITTED").length,pendingNca:s.nca.filter(x=>x.status==="SUBMITTED").length,pendingExpenses:s.expenses.filter(x=>x.status==="SUBMITTED").length,pendingLeaves:s.leaves.filter(x=>x.status==="SUBMITTED").length};
}
export function approvalQueue(s:QaState):ApprovalQueueItem[]{
 return[
  ...s.tourPlans.filter(x=>x.status==="SUBMITTED").map(x=>({kind:"TOUR_PLAN" as const,id:x.id,repId:x.repId,label:"Tour plan · "+x.date,status:x.status})),
  ...s.gpsExceptions.filter(x=>x.status==="SUBMITTED").map(x=>({kind:"GPS_EXCEPTION" as const,id:x.id,repId:x.repId,label:"GPS variance · "+x.distanceMeters+"m",status:x.status})),
  ...s.nca.filter(x=>x.status==="SUBMITTED").map(x=>({kind:"NCA" as const,id:x.id,repId:x.repId,label:x.category+" · "+x.town,status:x.status})),
  ...s.expenses.filter(x=>x.status==="SUBMITTED").map(x=>({kind:"EXPENSE" as const,id:x.id,repId:x.repId,label:x.category+" · "+x.currency+" "+x.amount,status:x.status})),
  ...s.leaves.filter(x=>x.status==="SUBMITTED").map(x=>({kind:"LEAVE" as const,id:x.id,repId:x.repId,label:x.type+" · "+x.from,status:x.status})),
 ];
}
export function decideQueue(s:QaState,item:ApprovalQueueItem,approve:boolean,comment?:string):QaState{
 const status=approve?"APPROVED":"RETURNED";
 if(item.kind==="TOUR_PLAN")return{...s,tourPlans:moveStatus(s.tourPlans,item.id,status,comment)};
 if(item.kind==="GPS_EXCEPTION")return{...s,gpsExceptions:moveStatus(s.gpsExceptions,item.id,status,comment)};
 if(item.kind==="NCA")return{...s,nca:moveStatus(s.nca,item.id,approve?"APPROVED":"REJECTED",comment)};
 if(item.kind==="EXPENSE")return{...s,expenses:moveStatus(s.expenses,item.id,status,comment)};
 return{...s,leaves:moveStatus(s.leaves,item.id,approve?"APPROVED":"REJECTED",comment)};
}

export function linkCustomers(s:QaState,sourceKind:"doctor"|"chemist",sourceId:string,targetKind:"chemist"|"stockist",targetId:string):QaState{
 ensureUnlocked(s);
 const valid=(sourceKind==="doctor"&&targetKind==="chemist")||(sourceKind==="chemist"&&targetKind==="stockist");
 if(!valid)throw new Error("Only Doctor → Chemist and Chemist → Stockist links are supported.");
 const exists=s.links.some(l=>sourceKind==="doctor"?l.type==="DOCTOR_CHEMIST"&&l.doctorId===sourceId&&l.chemistId===targetId:l.type==="CHEMIST_STOCKIST"&&l.chemistId===sourceId&&l.stockistId===targetId);
 if(exists)return s;
 const link=sourceKind==="doctor"?{id:`link-dc-${s.links.length+1}`,doctorId:sourceId,chemistId:targetId,type:"DOCTOR_CHEMIST" as const}:{id:`link-cs-${s.links.length+1}`,chemistId:sourceId,stockistId:targetId,type:"CHEMIST_STOCKIST" as const};
 return {...s,links:[...s.links,link]};
}
export function unlinkCustomer(s:QaState,id:string):QaState{ensureUnlocked(s);return{...s,links:s.links.filter(x=>x.id!==id)}}
