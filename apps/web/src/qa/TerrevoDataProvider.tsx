import {createContext,useCallback,useContext,useEffect,useMemo,useReducer,useRef,useState,type ReactNode} from "react";
import {QA_SCENARIOS,buildScenario} from "./qa-scenarios";
import {approvalQueue,activeVisit,bookPob,buildDcr,checkInVisit,closeVisit,decideNca,decideQueue,decideWorkforce,distributeInventory,finishClm,initialQaState,linkCustomers,managerMetrics,pobEligibility,qaReducer,rcpaEligibility,requestLeave,saveExpense,saveNca,saveRcpa,startClm,submitDcr,submitExpense,submitNca,submitTimesheet,unlinkCustomer} from "./qa-store";
import type {ApprovalQueueItem,ExpenseRecord,LeaveRecord,NcaRecord,QaScenario,QaState,Visit,ClmSession} from "./types";
import {TerrevoWebApi,freshPosition,type Session,type Tenant,type AccessContext,type Plan,type OrgUnit,type Master,type ManagerCommand} from "../terrevo-api";

type MaybePromise<T>=T|Promise<T>;
export type TerrevoDataMode="FUNCTIONAL_QA"|"LIVE_API";
export type LiveAuth={
 session:Session|null;tenants:Tenant[];tenantId:string|null;platformAdmin:boolean;
 login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>;selectTenant:(id:string)=>Promise<void>;
 provisionTenantUser:(input:{email:string;temporaryPassword:string;name:string;employeeCode:string;role:"MANAGER"|"MR";orgUnitId:string;reportingManagerEmployeeId?:string|null})=>Promise<void>;
 provisionTenantAdmin:(tenantId:string,input:{email:string;temporaryPassword:string;name:string})=>Promise<void>;
};
export type TerrevoDataContextValue={
 mode:TerrevoDataMode;state:QaState;scenario:QaScenario;setScenario:(s:QaScenario)=>void;resetScenario:()=>void;
 loading:boolean;error:string|null;refresh:()=>Promise<void>;auth:LiveAuth|null;api:TerrevoWebApi|null;
 access:AccessContext|null;units:OrgUnit[];masters:Record<string,Master[]>;plans:Plan[];startOptions:Array<{planId:string;planDayId:string;workDate:string;territoryId:string}>;
 activeVisit:ReturnType<typeof activeVisit>;rcpaEligibility:ReturnType<typeof rcpaEligibility>;pobEligibility:ReturnType<typeof pobEligibility>;
 managerMetrics:ReturnType<typeof managerMetrics>;approvalQueue:ApprovalQueueItem[];
 workday:{start:(planDayId:string)=>MaybePromise<void>;submit:(shortDayReason?:string|null)=>MaybePromise<void>};
 planning:{getPlan:(id:string)=>Promise<Plan>;savePlan:(weekStart:string,days:any[])=>Promise<Plan>;updatePlan:(id:string,weekStart:string,days:any[])=>Promise<Plan>;submitPlan:(id:string)=>Promise<void>;decidePlan:(id:string,d:"APPROVE"|"REJECT"|"RETURN",comment:string|null)=>Promise<void>};
 visits:{checkIn:(id:string)=>MaybePromise<void>;close:(id:string,outcome:string)=>MaybePromise<void>};
 clm:{start:(assetId:string,mode:"REHEARSAL"|"DETAILING")=>string;finish:(sessionId:string,reaction:"POSITIVE"|"NEUTRAL"|"NEGATIVE",dwells:{slideId:string;durationMs:number}[])=>MaybePromise<void>};
 inventory:{distribute:(inventoryId:string,qty:number)=>MaybePromise<void>};
 rcpa:{save:(input:{productId?:string;competitorBrand?:string;brandQty:number;competitorQty:number;rxCount:number})=>MaybePromise<void>};
 pob:{book:(lines:{productId:string;quantity:number}[],token:string)=>MaybePromise<void>};
 nca:{save:(input:Omit<NcaRecord,"id"|"status">)=>MaybePromise<void>;submit:(id:string)=>MaybePromise<void>;decide:(id:string,d:"APPROVED"|"REJECTED",comment?:string)=>MaybePromise<void>};
 workforce:{requestLeave:(input:Omit<LeaveRecord,"id"|"status">)=>MaybePromise<void>;saveExpense:(input:Omit<ExpenseRecord,"id"|"status">)=>MaybePromise<void>;submitExpense:(id:string)=>MaybePromise<void>;submitTimesheet:(id:string)=>MaybePromise<void>;decide:(kind:"LEAVE"|"EXPENSE"|"TIMESHEET",id:string,d:"APPROVED"|"REJECTED"|"RETURNED",comment?:string)=>MaybePromise<void>};
 dcr:{preview:ReturnType<typeof buildDcr>;submit:(repId?:string,date?:string)=>MaybePromise<void>};
 manager:{decide:(item:ApprovalQueueItem,approve:boolean,comment?:string)=>MaybePromise<void>};relationships:{link:(sourceKind:"doctor"|"chemist",sourceId:string,targetKind:"chemist"|"stockist",targetId:string)=>MaybePromise<void>;unlink:(id:string)=>MaybePromise<void>};
};
const Ctx=createContext<TerrevoDataContextValue|null>(null);
const noopAsync=async()=>{};
function qaMasters(state:QaState):Record<string,Master[]>{return{
 employees:state.reps.map(r=>({id:r.id,code:r.id,name:r.name,status:"active",territoryId:r.territoryId})),
 doctors:state.doctors.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),territoryId:x.territoryId,specialty:x.specialty,qualification:x.qualification})),
 chemists:state.chemists.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),territoryId:x.territoryId})),
 stockists:state.stockists.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),territoryId:x.territoryId})),
 products:state.products.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),divisionId:x.divisionId})),
 samples:state.inventory.filter(x=>x.kind==="SAMPLE").map(x=>({id:x.sourceItemId??x.id,code:x.code,name:x.name,status:"active",productId:x.productId})),
 gifts:state.inventory.filter(x=>x.kind!=="SAMPLE").map(x=>({id:x.sourceItemId??x.id,code:x.code,name:x.name,status:"active"})),
};}
export function FunctionalQaProvider({children}:{children:ReactNode}){
 const [state,dispatch]=useReducer(qaReducer,undefined,initialQaState);const replace=(next:QaState)=>dispatch({type:"REPLACE",state:next});
 const api=useMemo(()=>new TerrevoWebApi(),[]);
 const plans=useMemo<Plan[]>(()=>[{id:"qa-plan-provider",weekStart:"2026-10-12",status:"APPROVED",submittedAt:"2026-10-15T18:00:00+05:30",days:[{date:"2026-10-16",territoryId:state.territory.id,remarks:"Functional QA",stops:state.visits.map((v,i)=>({sequence:i+1,type:v.customerType.toLowerCase() as "doctor"|"chemist"|"stockist",targetId:v.customerId,remarks:"Functional QA"}))}]}],[state]);
 const value=useMemo<TerrevoDataContextValue>(()=>{const active=activeVisit(state);return{
  mode:"FUNCTIONAL_QA",state,scenario:state.scenario,setScenario:s=>dispatch({type:"SET_SCENARIO",scenario:s}),resetScenario:()=>dispatch({type:"RESET"}),loading:false,error:null,refresh:noopAsync,auth:null,api,
  access:null,units:[{id:state.territory.id,parentId:null,type:"territory",code:"QA-HYD",name:state.territory.name,status:"active"}],masters:qaMasters(state),plans,startOptions:active?[]:[{planId:"qa-plan-provider",planDayId:"qa-day",workDate:"2026-10-16",territoryId:state.territory.id}],
  activeVisit:active,rcpaEligibility:rcpaEligibility(state),pobEligibility:pobEligibility(state),managerMetrics:managerMetrics(state),approvalQueue:approvalQueue(state),
  workday:{start:()=>{},submit:()=>replace(submitDcr(state))},
  planning:{getPlan:async id=>plans.find(p=>p.id===id)!,savePlan:async()=>plans[0],updatePlan:async()=>plans[0],submitPlan:noopAsync,decidePlan:noopAsync},
  visits:{checkIn:id=>replace(checkInVisit(state,id)),close:(id,outcome)=>replace(closeVisit(state,id,outcome))},
  clm:{start:(assetId,mode)=>{const id=`clm-session-${state.clmSessions.length+1}`;replace(startClm(state,assetId,mode));return id;},finish:(sessionId,reaction,dwells)=>replace(finishClm(state,sessionId,reaction,dwells))},
  inventory:{distribute:(inventoryId,qty)=>replace(distributeInventory(state,inventoryId,qty))},rcpa:{save:input=>replace(saveRcpa(state,input))},pob:{book:(lines,token)=>replace(bookPob(state,lines,token))},
  nca:{save:input=>replace(saveNca(state,input)),submit:id=>replace(submitNca(state,id)),decide:(id,d,c)=>replace(decideNca(state,id,d,c))},
  workforce:{requestLeave:input=>replace(requestLeave(state,input)),saveExpense:input=>replace(saveExpense(state,input)),submitExpense:id=>replace(submitExpense(state,id)),submitTimesheet:id=>replace(submitTimesheet(state,id)),decide:(k,id,d,c)=>replace(decideWorkforce(state,k,id,d,c))},
  dcr:{preview:buildDcr(state),submit:(repId,date)=>replace(submitDcr(state,repId,date))},manager:{decide:(item,approve,comment)=>replace(decideQueue(state,item,approve,comment))},
  relationships:{link:(sk,sid,tk,tid)=>replace(linkCustomers(state,sk,sid,tk,tid)),unlink:id=>replace(unlinkCustomer(state,id))},
 }},[api,plans,state]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const EMPTY=buildScenario("EMPTY_TENANT");
const today=()=>new Date().toISOString().slice(0,10);
export function LiveApiProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[tenants,setTenants]=useState<Tenant[]>([]),[tenantId,setTenantId]=useState<string|null>(null);
 const [state,setState]=useState<QaState>(EMPTY),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[platformAdmin,setPlatformAdmin]=useState(false);
 const [access,setAccess]=useState<AccessContext|null>(null),[units,setUnits]=useState<OrgUnit[]>([]),[masters,setMasters]=useState<Record<string,Master[]>>({}),[plans,setPlans]=useState<Plan[]>([]),[startOptions,setStartOptions]=useState<Array<{planId:string;planDayId:string;workDate:string;territoryId:string}>>([]);
 const [liveManagerMetrics,setLiveManagerMetrics]=useState(managerMetrics(EMPTY)),[liveQueue,setLiveQueue]=useState<ApprovalQueueItem[]>([]);
 const tokenMap=useRef(new Map<string,string>()),api=useMemo(()=>new TerrevoWebApi(s=>{setSession(s);if(s)sessionStorage.setItem("terrevo-session",JSON.stringify(s));else sessionStorage.removeItem("terrevo-session")}),[]);

 const hydrate=useCallback(async()=>{
  if(!api.connected||!tenantId)return;
  setLoading(true);setError(null);
  try{
   const [ctx,org,employees,doctors,chemists,stockists,products,samples,gifts,planRows,progress,open,clmAssets,links,ncaOpts,ncaRows,attendance,leaves,expenses,timesheets,dcrRows,balances,start]=await Promise.all([
    api.access(),api.orgUnits(),api.masters("employees"),api.masters("doctors"),api.masters("chemists"),api.masters("stockists"),api.masters("products"),api.masters("samples"),api.masters("gifts"),
    api.plans(),api.progress(),api.openVisit(),api.clmAssets(),api.customerRelationships(),api.ncaOptions(),api.ownNcaRecords(),api.attendance(),api.leaves(),api.expenses(),api.weeklyTimesheets(),api.dcrs(),api.inventory(),api.startOptions()
   ]);
   setAccess(ctx);setUnits(org);setMasters({employees,doctors,chemists,stockists,products,samples,gifts});setPlans(planRows);setStartOptions(start);
   const tenant=tenants.find(x=>x.id===tenantId);const territoryId=ctx.orgAssignments.find(x=>x.isPrimary)?.orgUnitId??org.find(x=>x.type==="territory")?.id??"";
   const divisionId=org.find(x=>x.type==="division")?.id??territoryId;
   const reps=employees.filter(e=>String(e.status)==="active").map((e:any)=>({id:e.id,name:e.name,territoryId:String(e.orgUnitId??e.territoryId??territoryId),managerId:String(e.reportingManagerEmployeeId??"")}));
   let visits:Visit[]=[];
   if(progress){
    visits=progress.stops.map(x=>{const isOpen=open?.planStopId===x.planStopId;return{id:isOpen&&open?open.id:x.planStopId,planStopId:x.planStopId,executionId:progress.executionId,repId:session?.user.id??"",customerType:x.type.toUpperCase() as Visit["customerType"],customerId:x.targetId,territoryId:progress.territoryId,plannedAt:progress.workDate+"T09:00:00",status:x.status==="PENDING"?"PLANNED":x.status==="IN_PROGRESS"?"CHECKED_IN":"COMPLETED",checkinAt:isOpen?open?.checkinAt:undefined,checkoutAt:isOpen?open?.checkoutAt??undefined:undefined,gpsVariance:isOpen?open?.exceptionStatus!=="NOT_REQUIRED":false,clmSessionIds:[],sampleDistributionIds:[],rcpaIds:[],pobIds:[]}})}
   const clmSessions=open?await api.clmSessions(open.id).catch(()=>[]):[];
   if(open){visits=visits.map(v=>v.id===open.id?{...v,clmSessionIds:clmSessions.map(x=>x.id)}:v)}
   const sampleMap=new Map(samples.map(x=>[x.id,x])),giftMap=new Map(gifts.map(x=>[x.id,x]));
   const inventory=balances.map(b=>{const src=b.itemType==="sample"?sampleMap.get(b.itemId):giftMap.get(b.itemId);return{id:b.id,sourceItemId:b.itemId,code:String(src?.code??b.itemId),name:String(src?.name??b.itemId),kind:b.itemType==="sample"?"SAMPLE" as const:"GIFT" as const,productId:typeof src?.productId==="string"?src.productId:undefined,allocatedQty:b.quantity,distributedQty:0,availableQty:b.quantity}});
   const townMap=new Map(ncaOpts.towns.map(x=>[x.id,x.name]));
   const liveState:QaState={...EMPTY,scenario:"NORMAL_DAY",organization:{id:tenantId,name:tenant?.name??"Terrevo"},division:{id:divisionId,name:org.find(x=>x.id===divisionId)?.name??"Division"},territory:{id:territoryId,name:org.find(x=>x.id===territoryId)?.name??"Territory"},
    manager:{id:employees.find((e:any)=>String(e.designation).toLowerCase().includes("manager"))?.id??"",name:employees.find((e:any)=>String(e.designation).toLowerCase().includes("manager"))?.name??"Manager"},reps,
    doctors:doctors.map((x:any)=>({id:x.id,code:x.code,name:x.name,specialty:String(x.specialty??""),qualification:String(x.qualification??""),territoryId:String(x.territoryId??territoryId),category:(["A","B","C"].includes(String(x.category))?x.category:"B") as "A"|"B"|"C",status:String(x.status).toUpperCase()==="ACTIVE"?"ACTIVE":"INACTIVE"})),
    chemists:chemists.map((x:any)=>({id:x.id,code:x.code,name:x.name,territoryId:String(x.territoryId??territoryId),status:String(x.status).toUpperCase()==="ACTIVE"?"ACTIVE":"INACTIVE"})),
    stockists:stockists.map((x:any)=>({id:x.id,code:x.code,name:x.name,territoryId:String(x.territoryId??territoryId),status:String(x.status).toUpperCase()==="ACTIVE"?"ACTIVE":"INACTIVE"})),
    products:products.map((x:any)=>({id:x.id,code:x.code,name:x.name,divisionId:String(x.divisionId??divisionId),status:String(x.status).toUpperCase()==="ACTIVE"?"ACTIVE":"INACTIVE"})),
    links:links.map(l=>l.relationship==="DOCTOR_CHEMIST"?{id:l.id,type:"DOCTOR_CHEMIST",doctorId:l.sourceId,chemistId:l.targetId}:{id:l.id,type:"CHEMIST_STOCKIST",chemistId:l.sourceId,stockistId:l.targetId}),
    clmAssets:clmAssets.map(a=>({id:a.id,code:a.code,title:a.title,version:a.version,category:a.category,status:a.status,effectiveFrom:a.effectiveFrom,expiresAt:a.expiresAt??undefined,productIds:a.productIds,slides:a.slides.map(x=>({id:x.id,title:x.title,body:x.body}))})),
    clmSessions:clmSessions.map(x=>({id:x.id,mode:"DETAILING",assetId:x.assetId,visitId:x.visitId,startedAt:x.startedAt,endedAt:x.endedAt,reaction:x.reaction,slideDwells:x.slideDwells})),inventory,distributions:[],
    ncaCategories:ncaOpts.categories.map(x=>({code:x.code as any,label:x.label,active:x.active})),ncaTowns:ncaOpts.towns,nca:ncaRows.map(x=>({id:x.id,repId:x.createdBy??session?.user.id??"",category:x.categoryCode as any,town:x.townId?townMap.get(x.townId)??x.townId:"",date:x.workDate,durationMinutes:x.durationMinutes,reason:x.reason,remarks:x.remarks,status:x.status,managerComment:x.managerComment??undefined})),
    visits,rcpa:[],pob:[],attendance:attendance.map((x,i)=>({id:"attendance-"+i,repId:session?.user.id??"",date:x.workDate,status:x.status==="SHORT_DAY"?"SHORT_DAY":x.status==="FIELD_DAY"?"FIELD_DAY":"PRESENT",workedMinutes:x.workedMinutes??0,requiredMinutes:x.requiredMinutes??480})),
    leaves:leaves.map((x:any)=>({id:x.id,repId:session?.user.id??"",from:x.startDate,to:x.endDate,type:x.leaveType,reason:x.reason,status:x.status,managerComment:x.managerComment??undefined})),
    expenses:expenses.map((x:any)=>({id:x.id,repId:session?.user.id??"",date:x.workDate,category:(x.category??"OTHER") as any,amount:Number(x.totalAmount),currency:"INR",status:x.status})),
    timesheets:timesheets.map((x:any)=>({id:x.id,repId:session?.user.id??"",weekStart:x.weekStart,days:[{date:x.weekStart,hours:Number(x.totalMinutes??0)/60}],status:x.status})),
    tourPlans:planRows.map(p=>({id:p.id,repId:session?.user.id??"",date:p.weekStart,status:p.status as any,plannedVisitIds:[]})),gpsExceptions:[],
    dcrs:dcrRows.map(x=>({id:x.id,repId:session?.user.id??"",date:x.submittedAt.slice(0,10),visitIds:[x.visitId],ncaIds:[],clmSessionIds:[],sampleDistributionIds:[],rcpaIds:[],pobIds:[],status:"SUBMITTED",submittedAt:x.submittedAt,locked:false})),lockedDate:progress?undefined:attendance.some(x=>x.workDate===today()&&dcrRows.length>0)?today():undefined};
   setState(liveState);
   let m=managerMetrics(liveState),queue:ApprovalQueueItem[]=[];
   if(ctx.permissions.includes("MANAGER_DASHBOARD_VIEW")||ctx.permissions.includes("TOUR_APPROVE")){
    const [cmd,pendingPlans,gps,pendingNca,pendingExpenses,pendingLeaves]=await Promise.all([api.manager().catch(()=>null),api.pendingPlans().catch(()=>[]),api.gpsExceptions().catch(()=>[]),api.pendingNcaRecords().catch(()=>[]),api.pendingExpenseApprovals().catch(()=>[]),api.pendingLeaveApprovals().catch(()=>[])]);
    if(cmd)m={...m,teamMembers:cmd.teamMembers,activeTours:cmd.activeTours,submittedDays:cmd.submittedToursToday,pendingTourPlans:cmd.pending.tourApprovals,pendingGpsExceptions:cmd.pending.gpsExceptions,pendingExpenses:cmd.pending.expenses,pendingLeaves:cmd.pending.leaves,pendingNca:pendingNca.length};
    queue=[...pendingPlans.map(x=>({kind:"TOUR_PLAN" as const,id:x.id,repId:"",label:"Tour plan · "+x.weekStart,status:x.status as any})),...gps.map(x=>({kind:"GPS_EXCEPTION" as const,id:x.id,repId:"",label:"GPS variance · "+String(x.distanceMeters??0)+"m",status:"SUBMITTED" as const})),...pendingNca.map(x=>({kind:"NCA" as const,id:x.id,repId:x.createdBy??"",label:x.categoryCode+" · "+(townMap.get(x.townId??"")??""),status:x.status})),...pendingExpenses.map(x=>({kind:"EXPENSE" as const,id:x.id,repId:x.employeeId,label:"Expense · "+x.currencyCode+" "+x.totalAmount,status:x.status as any})),...pendingLeaves.map(x=>({kind:"LEAVE" as const,id:x.id,repId:x.employeeId,label:x.leaveType+" · "+x.startDate,status:x.status as any}))];
   }
   setLiveManagerMetrics(m);setLiveQueue(queue);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load live Terrevo data");throw e}finally{setLoading(false)}
 },[api,session?.user.id,tenantId,tenants]);

 const chooseTenant=useCallback(async(id:string)=>{api.setTenant(id);setTenantId(id);await Promise.resolve();},[api]);
 useEffect(()=>{if(tenantId&&api.connected)void hydrate()},[tenantId,session?.accessToken]);
 useEffect(()=>{const raw=sessionStorage.getItem("terrevo-session");if(!raw)return;try{const saved=JSON.parse(raw) as Session;api.setSession(saved);setSession(saved);void (async()=>{try{const [ts,isPlatform]=await Promise.all([api.tenants(),api.platformContext().catch(()=>false)]);setTenants(ts);setPlatformAdmin(isPlatform);if(ts[0]){api.setTenant(ts[0].id);setTenantId(ts[0].id)}}catch{api.reset()}})()}catch{sessionStorage.removeItem("terrevo-session")}},[api]);
 const refresh=useCallback(async()=>{await hydrate()},[hydrate]);
 const login=useCallback(async(email:string,password:string)=>{setLoading(true);setError(null);try{const ss=await api.login(email,password);setSession(ss);const [ts,isPlatform]=await Promise.all([api.tenants(),api.platformContext().catch(()=>false)]);setTenants(ts);setPlatformAdmin(isPlatform);if(ts[0]){api.setTenant(ts[0].id);setTenantId(ts[0].id)}else setState({...EMPTY,organization:{id:"platform",name:"Platform administration"}})}catch(e){setError(e instanceof Error?e.message:"Login failed");throw e}finally{setLoading(false)}},[api]);
 const logout=useCallback(async()=>{await api.logout();setSession(null);setTenants([]);setTenantId(null);setAccess(null);setState(EMPTY)},[api]);
 const selectTenant=useCallback(async(id:string)=>{if(!tenants.some(x=>x.id===id))throw new Error("Tenant is not accessible");api.setTenant(id);setTenantId(id)},[api,tenants]);
 const mutate=useCallback(async(fn:()=>Promise<unknown>)=>{await fn();await hydrate()},[hydrate]);
 const idForToken=(token:string)=>{let id=tokenMap.current.get(token);if(!id){id=crypto.randomUUID();tokenMap.current.set(token,id)}return id};
 const active=activeVisit(state);
 const rcpaGate=rcpaEligibility(state),pobGate=pobEligibility(state);
 const auth:LiveAuth={session,tenants,tenantId,platformAdmin,login,logout,selectTenant,
  provisionTenantUser:async input=>mutate(()=>api.provisionTenantUser(input)),provisionTenantAdmin:async(t,input)=>{await api.provisionPlatformTenantAdmin(t,input)}};
 const value:TerrevoDataContextValue={
  mode:"LIVE_API",state,scenario:"NORMAL_DAY",setScenario:()=>{throw new Error("Scenarios are available only in Functional QA mode")},resetScenario:()=>{},loading,error,refresh,auth,api,access,units,masters,plans,startOptions,
  activeVisit:active,rcpaEligibility:rcpaGate,pobEligibility:pobGate,managerMetrics:liveManagerMetrics,approvalQueue:liveQueue,
  workday:{start:async planDayId=>mutate(async()=>api.startTour(planDayId,await freshPosition())),submit:async reason=>mutate(()=>api.submitTour(reason??null))},
  planning:{getPlan:id=>api.getPlan(id),savePlan:(weekStart,days)=>api.savePlan(weekStart,days),updatePlan:(id,weekStart,days)=>api.updatePlan(id,weekStart,days),submitPlan:async id=>{await mutate(()=>api.submitPlan(id))},decidePlan:async(id,d,c)=>{await mutate(()=>api.decidePlan(id,d,c))}},
  visits:{checkIn:async id=>{const v=state.visits.find(x=>x.id===id||x.planStopId===id);await mutate(async()=>api.checkIn(v?.planStopId??id,await freshPosition(),null))},close:async(id,outcome)=>{const v=state.visits.find(x=>x.id===id);if(!v)throw new Error("Visit not found");await mutate(async()=>{if(v.customerType==="DOCTOR")await api.doctorCall(id,outcome,null);else await api.tradeCall(id,outcome,null);await api.checkOut(id,await freshPosition())})}},
  clm:{start:(assetId,mode)=>{const id="local-"+crypto.randomUUID();const sess:ClmSession={id,mode,assetId,visitId:mode==="DETAILING"?active?.id:undefined,startedAt:new Date().toISOString(),slideDwells:[]};setState(old=>({...old,clmSessions:[...old.clmSessions,sess]}));return id;},finish:async(sessionId,reaction,dwells)=>{const sess=state.clmSessions.find(x=>x.id===sessionId);if(!sess)throw new Error("CLM session not found");if(sess.mode==="REHEARSAL"){setState(old=>({...old,clmSessions:old.clmSessions.map(x=>x.id===sessionId?{...x,endedAt:new Date().toISOString(),reaction,slideDwells:dwells}:x)}));return}if(!sess.visitId)throw new Error("Detailing requires an active doctor visit");await mutate(()=>api.saveClmSession(sess.visitId!,{assetId:sess.assetId,startedAt:sess.startedAt,endedAt:new Date().toISOString(),reaction,slideDwells:dwells}))}},
  inventory:{distribute:async(inventoryId,qty)=>{const item=state.inventory.find(x=>x.id===inventoryId),v=active;if(!item||!item.sourceItemId)throw new Error("Inventory item not found");if(!v||v.customerType!=="DOCTOR")throw new Error("Distribution requires an active checked-in doctor visit");await mutate(()=>api.distribute(v.id,[{itemType:item.kind==="SAMPLE"?"sample":"gift",itemId:item.sourceItemId!,quantity:qty}],crypto.randomUUID()))}},
  rcpa:{save:async input=>{if(!active||active.customerType!=="CHEMIST")throw new Error(rcpaGate.reason??"Chemist visit required");const lines:any[]=[];let seq=1;if(input.productId&&(input.brandQty>0||input.rxCount>0))lines.push({sequence:seq++,productId:input.productId,competitorBrand:null,prescriptionCount:input.rxCount,stockQuantity:0,salesQuantity:input.brandQty});if(input.competitorBrand&&input.competitorQty>0)lines.push({sequence:seq++,productId:null,competitorBrand:input.competitorBrand,prescriptionCount:0,stockQuantity:0,salesQuantity:input.competitorQty});if(!lines.length)throw new Error("Enter observed RCPA quantities");await mutate(()=>api.saveRcpa(active.id,lines,crypto.randomUUID()))}},
  pob:{book:async(lines,token)=>{if(!active)throw new Error(pobGate.reason??"Trade visit required");await mutate(()=>api.saveOrder(active.id,lines.map((x,i)=>({sequence:i+1,productId:x.productId,quantity:x.quantity,remarks:null})),idForToken(token)))}},
  nca:{save:async input=>{const town=state.ncaTowns.find(x=>x.name===input.town);if(!town)throw new Error("Authorized NCA town not found");await mutate(()=>api.saveNcaDraft({phase:"PLAN",workDate:input.date,territoryId:state.territory.id,categoryCode:input.category,townId:town.id,reason:input.reason,remarks:input.remarks,durationMinutes:input.durationMinutes}))},submit:async id=>mutate(()=>api.submitNca(id)),decide:async(id,d,c)=>mutate(()=>api.decideNca(id,d==="APPROVED"?"APPROVE":"REJECT",c??null))},
  workforce:{requestLeave:async input=>mutate(()=>api.requestLeave(input.type,input.from,input.to,input.reason)),saveExpense:async input=>{const exec=active?.executionId;if(!exec)throw new Error("Expense capture requires an active field day");await mutate(()=>api.saveExpense(exec,"INR",input.amount,input.category==="FOOD"?"MEAL":input.category as any,null))},submitExpense:async id=>mutate(()=>api.submitExpense(id,null)),submitTimesheet:async id=>mutate(()=>api.submitWeeklyTimesheet(id,null)),decide:async(kind,id,d,c)=>{if(kind==="LEAVE")await mutate(()=>api.decideLeave(id,d==="APPROVED"?"APPROVE":"REJECT",c??null));else if(kind==="EXPENSE")await mutate(()=>api.decideExpense(id,d==="APPROVED"?"APPROVE":d==="RETURNED"?"RETURN":"REJECT",c??null));else await mutate(()=>api.decideWeeklyTimesheet(id,d==="APPROVED"?"APPROVE":"RETURN",c??null))}},
  dcr:{preview:buildDcr(state),submit:async()=>mutate(()=>api.submitTour(null))},
  manager:{decide:async(item,approve,comment)=>{if(item.kind==="TOUR_PLAN")await mutate(()=>api.decidePlan(item.id,approve?"APPROVE":"RETURN",comment??null));else if(item.kind==="GPS_EXCEPTION")await mutate(()=>api.decideGpsException(item.id,approve?"APPROVE":"REJECT",comment??null));else if(item.kind==="NCA")await mutate(()=>api.decideNca(item.id,approve?"APPROVE":"REJECT",comment??null));else if(item.kind==="EXPENSE")await mutate(()=>api.decideExpense(item.id,approve?"APPROVE":"RETURN",comment??null));else await mutate(()=>api.decideLeave(item.id,approve?"APPROVE":"REJECT",comment??null))}},
  relationships:{link:async(sk,sid,tk,tid)=>mutate(()=>api.linkCustomer(sk,sid,tk,tid)),unlink:async id=>mutate(()=>api.unlinkCustomer(id))},
 };
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function TerrevoDataProvider({children}:{children:ReactNode}){return <FunctionalQaProvider>{children}</FunctionalQaProvider>}
export function useTerrevoData(){const v=useContext(Ctx);if(!v)throw new Error("useTerrevoData must be used within TerrevoDataProvider");return v}
export function useVisit(){const v=useTerrevoData();return{activeVisit:v.activeVisit,visits:v.state.visits,...v.visits,workday:v.workday,startOptions:v.startOptions}}
export function useClm(){const v=useTerrevoData();return{assets:v.state.clmAssets,sessions:v.state.clmSessions,activeVisit:v.activeVisit,...v.clm}}
export function useInventory(){const v=useTerrevoData();return{balances:v.state.inventory,distributions:v.state.distributions,activeVisit:v.activeVisit,...v.inventory}}
export function useTrade(){const v=useTerrevoData();return{records:v.state.rcpa,orders:v.state.pob,links:v.state.links,rcpaEligibility:v.rcpaEligibility,pobEligibility:v.pobEligibility,...v.rcpa,...v.pob}}
export function useNca(){const v=useTerrevoData();return{records:v.state.nca,activeVisit:v.activeVisit,...v.nca}}
export function useWorkforce(){const v=useTerrevoData();return{attendance:v.state.attendance,leaves:v.state.leaves,expenses:v.state.expenses,timesheets:v.state.timesheets,...v.workforce}}
export function useDcr(){const v=useTerrevoData();return{records:v.state.dcrs,preview:v.dcr.preview,lockedDate:v.state.lockedDate,submit:v.dcr.submit}}
export function useManagerCommand(){const v=useTerrevoData();return{metrics:v.managerMetrics,queue:v.approvalQueue,decide:v.manager.decide}}
export {QA_SCENARIOS};
