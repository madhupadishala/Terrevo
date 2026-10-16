import {createBaseQaState,QA_DATE} from "./qa-fixtures";
import type {QaScenario,QaState} from "./types";
export const QA_SCENARIOS:Array<{id:QaScenario;label:string;description:string}>=[
 {id:"NORMAL_DAY",label:"Normal Day",description:"Morning state with scheduled visits ready for check-in."},
 {id:"FULL_FIELD_DAY",label:"Full Field Day",description:"Doctor interaction in progress plus linked trade activity."},
 {id:"MANAGER_QUEUE",label:"Manager Queue",description:"Approval and exception queues populated across five reps."},
 {id:"VALIDATION_ERRORS",label:"Validation Errors",description:"Expired content, zero stock, unlinked outlet and short-day edge states."},
 {id:"COMPLETED_DAY",label:"Completed Day",description:"Closed and locked field day with submitted DCR."},
 {id:"EMPTY_TENANT",label:"Empty Tenant",description:"Zero-data baseline for empty states."},
];
export function buildScenario(id:QaScenario):QaState{
 const s=createBaseQaState();s.scenario=id;
 if(id==="FULL_FIELD_DAY"){
  s.visits=s.visits.map(v=>v.id==="visit-doc-01"?{...v,status:"CHECKED_IN",checkinAt:QA_DATE+"T09:05:00+05:30"}:v);
  return s;
 }
 if(id==="MANAGER_QUEUE"){
  s.tourPlans=s.tourPlans.map((p,i)=>i<2?{...p,status:"SUBMITTED"}:p);
  s.nca=[...s.nca,{id:"nca-03",repId:"rep-hyd-05",category:"CAMP",town:"Secunderabad",date:QA_DATE,durationMinutes:120,reason:"Health camp",remarks:"Approval requested",status:"SUBMITTED"}];
  s.expenses=[...s.expenses,{id:"exp-04",repId:"rep-hyd-05",date:QA_DATE,category:"TRAVEL",amount:625,currency:"INR",status:"SUBMITTED"}];
  return s;
 }
 if(id==="VALIDATION_ERRORS"){
  s.inventory=s.inventory.map((x,i)=>i===0?{...x,distributedQty:x.allocatedQty,availableQty:0}:x);
  s.links=s.links.filter(x=>x.chemistId!=="chem-04");
  s.visits=s.visits.map(v=>v.id==="visit-chem-01"?{...v,customerId:"chem-04",status:"CHECKED_IN",checkinAt:QA_DATE+"T11:00:00+05:30"}:v);
  s.attendance=[...s.attendance,{id:"att-error",repId:"rep-hyd-02",date:QA_DATE,status:"SHORT_DAY",workedMinutes:120,requiredMinutes:480}];
  return s;
 }
 if(id==="COMPLETED_DAY"){
  s.visits=s.visits.map(v=>({...v,status:"COMPLETED",checkinAt:v.plannedAt,checkoutAt:QA_DATE+"T15:00:00+05:30",callOutcome:"Completed"}));
  s.dcrs=[{id:"dcr-complete",repId:"rep-hyd-01",date:QA_DATE,visitIds:s.visits.map(v=>v.id),ncaIds:["nca-01"],status:"SUBMITTED",submittedAt:QA_DATE+"T18:00:00+05:30",locked:true}];
  s.lockedDate=QA_DATE;return s;
 }
 if(id==="EMPTY_TENANT"){
  return {...s,doctors:[],chemists:[],stockists:[],products:[],links:[],clmAssets:[],clmSessions:[],inventory:[],distributions:[],visits:[],rcpa:[],pob:[],nca:[],attendance:[],leaves:[],expenses:[],timesheets:[],tourPlans:[],gpsExceptions:[],dcrs:[]};
 }
 return s;
}
