import {createContext,useContext,useMemo,useReducer,type ReactNode} from "react";
import {QA_SCENARIOS,buildScenario} from "./qa-scenarios";
import {approvalQueue,activeVisit,bookPob,buildDcr,checkInVisit,closeVisit,decideNca,decideQueue,decideWorkforce,distributeInventory,finishClm,initialQaState,linkCustomers,managerMetrics,pobEligibility,qaReducer,rcpaEligibility,requestLeave,saveExpense,saveNca,saveRcpa,startClm,submitDcr,submitExpense,submitNca,submitTimesheet,unlinkCustomer} from "./qa-store";
import type {ApprovalQueueItem,ExpenseRecord,LeaveRecord,NcaRecord,QaScenario,QaState} from "./types";

export type TerrevoDataMode="FUNCTIONAL_QA"|"LIVE_API";
export type TerrevoDataContextValue={
 mode:TerrevoDataMode;state:QaState;scenario:QaScenario;setScenario:(s:QaScenario)=>void;resetScenario:()=>void;
 activeVisit:ReturnType<typeof activeVisit>;rcpaEligibility:ReturnType<typeof rcpaEligibility>;pobEligibility:ReturnType<typeof pobEligibility>;
 managerMetrics:ReturnType<typeof managerMetrics>;approvalQueue:ApprovalQueueItem[];
 visits:{checkIn:(id:string)=>void;close:(id:string,outcome:string)=>void};
 clm:{start:(assetId:string,mode:"REHEARSAL"|"DETAILING")=>string;finish:(sessionId:string,reaction:"POSITIVE"|"NEUTRAL"|"NEGATIVE",dwells:{slideId:string;durationMs:number}[])=>void};
 inventory:{distribute:(inventoryId:string,qty:number)=>void};
 rcpa:{save:(input:{productId?:string;competitorBrand?:string;brandQty:number;competitorQty:number;rxCount:number})=>void};
 pob:{book:(lines:{productId:string;quantity:number}[],token:string)=>void};
 nca:{save:(input:Omit<NcaRecord,"id"|"status">)=>void;submit:(id:string)=>void;decide:(id:string,d:"APPROVED"|"REJECTED",comment?:string)=>void};
 workforce:{requestLeave:(input:Omit<LeaveRecord,"id"|"status">)=>void;saveExpense:(input:Omit<ExpenseRecord,"id"|"status">)=>void;submitExpense:(id:string)=>void;submitTimesheet:(id:string)=>void;decide:(kind:"LEAVE"|"EXPENSE"|"TIMESHEET",id:string,d:"APPROVED"|"REJECTED"|"RETURNED",comment?:string)=>void};
 dcr:{preview:ReturnType<typeof buildDcr>;submit:(repId?:string,date?:string)=>void};
 manager:{decide:(item:ApprovalQueueItem,approve:boolean,comment?:string)=>void};relationships:{link:(sourceKind:"doctor"|"chemist",sourceId:string,targetKind:"chemist"|"stockist",targetId:string)=>void;unlink:(id:string)=>void};
};
const Ctx=createContext<TerrevoDataContextValue|null>(null);
export function FunctionalQaProvider({children}:{children:ReactNode}){
 const [state,dispatch]=useReducer(qaReducer,undefined,initialQaState);
 const replace=(next:QaState)=>dispatch({type:"REPLACE",state:next});
 const value=useMemo<TerrevoDataContextValue>(()=>{
  const active=activeVisit(state);
  return{
   mode:"FUNCTIONAL_QA",state,scenario:state.scenario,setScenario:s=>dispatch({type:"SET_SCENARIO",scenario:s}),resetScenario:()=>dispatch({type:"RESET"}),
   activeVisit:active,rcpaEligibility:rcpaEligibility(state),pobEligibility:pobEligibility(state),managerMetrics:managerMetrics(state),approvalQueue:approvalQueue(state),
   visits:{checkIn:id=>replace(checkInVisit(state,id)),close:(id,outcome)=>replace(closeVisit(state,id,outcome))},
   clm:{start:(assetId,mode)=>{const id=`clm-session-${state.clmSessions.length+1}`;replace(startClm(state,assetId,mode));return id;},finish:(sessionId,reaction,dwells)=>replace(finishClm(state,sessionId,reaction,dwells))},
   inventory:{distribute:(inventoryId,qty)=>replace(distributeInventory(state,inventoryId,qty))},
   rcpa:{save:input=>replace(saveRcpa(state,input))},
   pob:{book:(lines,token)=>replace(bookPob(state,lines,token))},
   nca:{save:input=>replace(saveNca(state,input)),submit:id=>replace(submitNca(state,id)),decide:(id,d,c)=>replace(decideNca(state,id,d,c))},
   workforce:{requestLeave:input=>replace(requestLeave(state,input)),saveExpense:input=>replace(saveExpense(state,input)),submitExpense:id=>replace(submitExpense(state,id)),submitTimesheet:id=>replace(submitTimesheet(state,id)),decide:(k,id,d,c)=>replace(decideWorkforce(state,k,id,d,c))},
   dcr:{preview:buildDcr(state),submit:(repId,date)=>replace(submitDcr(state,repId,date))},
   manager:{decide:(item,approve,comment)=>replace(decideQueue(state,item,approve,comment))},relationships:{link:(sk,sid,tk,tid)=>replace(linkCustomers(state,sk,sid,tk,tid)),unlink:id=>replace(unlinkCustomer(state,id))},
  };
 },[state]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function LiveApiProvider({children}:{children:ReactNode}){
 const fail=()=>{throw new Error("Live API provider is intentionally inactive until functional acceptance and authentication integration.")};
 const empty=buildScenario("EMPTY_TENANT");
 const value=useMemo<TerrevoDataContextValue>(()=>({
  mode:"LIVE_API",state:empty,scenario:"NORMAL_DAY",setScenario:fail,resetScenario:fail,activeVisit:null,rcpaEligibility:{enabled:false,reason:"Live adapter inactive"},pobEligibility:{enabled:false,reason:"Live adapter inactive"},managerMetrics:managerMetrics(empty),approvalQueue:[],
  visits:{checkIn:fail,close:fail},clm:{start:fail,finish:fail},inventory:{distribute:fail},rcpa:{save:fail},pob:{book:fail},nca:{save:fail,submit:fail,decide:fail},workforce:{requestLeave:fail,saveExpense:fail,submitExpense:fail,submitTimesheet:fail,decide:fail},dcr:{preview:buildDcr(empty),submit:fail},manager:{decide:fail},relationships:{link:fail,unlink:fail},
 }),[]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function TerrevoDataProvider({children}:{children:ReactNode}){return <FunctionalQaProvider>{children}</FunctionalQaProvider>}
export function useTerrevoData(){const v=useContext(Ctx);if(!v)throw new Error("useTerrevoData must be used within TerrevoDataProvider");return v}
export function useVisit(){const v=useTerrevoData();return{activeVisit:v.activeVisit,visits:v.state.visits,...v.visits}}
export function useClm(){const v=useTerrevoData();return{assets:v.state.clmAssets,sessions:v.state.clmSessions,activeVisit:v.activeVisit,...v.clm}}
export function useInventory(){const v=useTerrevoData();return{balances:v.state.inventory,distributions:v.state.distributions,activeVisit:v.activeVisit,...v.inventory}}
export function useTrade(){const v=useTerrevoData();return{records:v.state.rcpa,orders:v.state.pob,links:v.state.links,rcpaEligibility:v.rcpaEligibility,pobEligibility:v.pobEligibility,...v.rcpa,...v.pob}}
export function useNca(){const v=useTerrevoData();return{records:v.state.nca,activeVisit:v.activeVisit,...v.nca}}
export function useWorkforce(){const v=useTerrevoData();return{attendance:v.state.attendance,leaves:v.state.leaves,expenses:v.state.expenses,timesheets:v.state.timesheets,...v.workforce}}
export function useDcr(){const v=useTerrevoData();return{records:v.state.dcrs,preview:v.dcr.preview,lockedDate:v.state.lockedDate,submit:v.dcr.submit}}
export function useManagerCommand(){const v=useTerrevoData();return{metrics:v.managerMetrics,queue:v.approvalQueue,decide:v.manager.decide}}
export {QA_SCENARIOS};
