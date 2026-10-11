import type {Progress,StartOption,ManagerCommand} from "../../terrevo-api";
export type AiSuggestion = {id:string;tenantId:string;summary:string;reason:string;actionType:string;sourceType:string;sourceId:string;sourceObservedAt:string;
 evidence:{label:string;reference:string}[];confidence:number|null;uncertainty:string;requiresHumanReview:true};
export type TodayIntelligenceViewProps = {tenantId:string;authorizedForTenantId:string;contextKey:string;
 progress:Progress|null;startOptions:StartOption[];manager?:ManagerCommand|null;
 aiSuggestions?:AiSuggestion[];todayLocalDate:string;loading?:boolean;error?:string|null;
 onOpenPlan?:(planId:string,planDayId:string)=>void;
 onOpenStop?:(planStopId:string)=>void;
 onConfirmSuggestion?:(suggestion:AiSuggestion)=>void};
export type TodaySummary = {hasVerifiedTour:boolean;planned:number;completed:number;pending:number;
 nextStops:Progress["stops"];startOptions:StartOption[];managerPending:{name:string;count:number}[];message:string};
export function buildTodaySummary(today:string,progress:Progress|null,options:StartOption[],manager?:ManagerCommand|null):TodaySummary{
 const fresh=Boolean(progress&&progress.workDate===today);
 const current=fresh?progress:null;
 const eligibleOptions=options.filter(o=>o.workDate===today);
 const pending=manager?.localDate===today ? [
  {name:"Tour approvals",count:manager.pending.tourApprovals},
  {name:"GPS exceptions",count:manager.pending.gpsExceptions},
  {name:"Weekly timesheets",count:manager.pending.weeklyTimesheets},
  {name:"Leave requests",count:manager.pending.leaves},
  {name:"Expense approvals",count:manager.pending.expenses},
 ].filter(x=>Number.isFinite(x.count)&&x.count>0):[];
 return {hasVerifiedTour:fresh,planned:current?.plannedCount??0,completed:current?.completedCount??0,
 pending:current?.pendingCount??0,nextStops:current?.stops.filter(x=>x.status!=="COMPLETED").sort((a,b)=>a.sequence-b.sequence)??[],
 startOptions:eligibleOptions,managerPending:pending,
 message:fresh?"Current tour execution from authorized records.":eligibleOptions.length?"No tour started for the selected date.":"No current verified activity."};
}
export function visibleSuggestions(tenant:string,items:AiSuggestion[]=[]):AiSuggestion[]{
 // Duplicate IDs are ambiguous review/action identities. Exclude every duplicate rather than selecting the first.
 const count=new Map<string,number>();
 for(const item of items){if(item.tenantId===tenant)count.set(item.id,(count.get(item.id)??0)+1);}
 return items.filter(x=>x.tenantId===tenant&&count.get(x.id)===1&&x.requiresHumanReview===true&&x.id&&x.summary.trim()&&x.actionType.trim()&&x.sourceId&&x.sourceType&&x.sourceObservedAt&&
 x.evidence.length>0&&x.evidence.every(e=>e.label.trim()&&e.reference.trim())&&
 (x.confidence===null||(Number.isFinite(x.confidence)&&x.confidence>=0&&x.confidence<=1))&&x.uncertainty.trim());
}
