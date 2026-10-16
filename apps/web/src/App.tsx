import {useMemo,useState} from "react";
import {Button,Tag,TextArea,TextInput,Tile} from "@carbon/react";
import {BusinessWorkspace,type BusinessArea} from "./BusinessWorkspace";
import {Customer360View} from "./features/customer360/Customer360View";
import {ActivitiesView} from "./features/activities/ActivitiesView";
import {EDetailingView} from "./features/edetailing/EDetailingView";
import {MonthlyPlanner} from "./MonthlyPlanner";
import {TodayIntelligenceView} from "./features/intelligence/TodayIntelligenceView";
import {TerrevoWebApi,type Master,type Plan,type PlanDay,type Progress,type StartOption,type ManagerCommand,type CustomerRelationship as LegacyRelationship} from "./terrevo-api";
import {useDcr,useManagerCommand,useNca,useTerrevoData,useVisit} from "./qa/TerrevoDataProvider";
import {FunctionalQaFieldExecution} from "./qa/FunctionalQaFieldExecution";
import {FunctionalQaManagerCommand} from "./qa/FunctionalQaManagerCommand";

type Area="overview"|"today"|"customers"|"activities"|"edetailing"|"field"|"plans"|"manager"|"admin"|"platform"|BusinessArea;
const NAV:Array<{id:Area;title:string;subtitle:string;icon:string}>=[
 {id:"overview",title:"Command overview",subtitle:"Operational QA summary",icon:"▦"},
 {id:"today",title:"Today briefing",subtitle:"Daily field agenda",icon:"◴"},
 {id:"customers",title:"Customer 360",subtitle:"Doctors, chemists, stockists and outlet graph",icon:"◎"},
 {id:"activities",title:"NCA & activities",subtitle:"Controlled non-call activities",icon:"▣"},
 {id:"edetailing",title:"E-detailing / CLM",subtitle:"Approved content and detailing sessions",icon:"▧"},
 {id:"field",title:"Field execution",subtitle:"Visit lifecycle and call completion",icon:"⌖"},
 {id:"plans",title:"Tour planning",subtitle:"Monthly, weekly and daily planning",icon:"▤"},
 {id:"trade",title:"RCPA & orders",subtitle:"Retail audit and POB",icon:"▥"},
 {id:"inventory",title:"Samples & inventory",subtitle:"Representative stock and distributions",icon:"▧"},
 {id:"workforce",title:"Workforce operations",subtitle:"Attendance, leave, expenses and timesheets",icon:"◷"},
 {id:"reports",title:"Daily call reports",subtitle:"Deterministic DCR rollup",icon:"▦"},
 {id:"manager",title:"Manager command",subtitle:"Five-rep operational command center",icon:"◫"},
 {id:"approvals",title:"Manager approvals",subtitle:"Tour, GPS, NCA and workforce decisions",icon:"✓"},
 {id:"admin",title:"Organization admin",subtitle:"Hierarchy and master field inspection",icon:"⚙"},
 {id:"platform",title:"Platform Super Admin",subtitle:"Local-only platform field inspection",icon:"◇"},
];

const monday=(date:string)=>{const d=new Date(date+"T12:00:00");d.setDate(d.getDate()-((d.getDay()+6)%7));return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const tagType=(status:string):"green"|"blue"|"red"|"gray"|"purple"=>status==="APPROVED"||status==="COMPLETED"||status==="SUBMITTED"?"green":status==="CHECKED_IN"?"blue":status==="REJECTED"?"red":"gray";
function Metric({label,value,context}:{label:string;value:string|number;context:string}){return <Tile className="tr-metric"><p className="tr-metric-label">{label}</p><strong className="tr-metric-number">{value}</strong><p className="tr-muted">{context}</p></Tile>}
function Panel({eyebrow,title,children}:{eyebrow:string;title:string;children:React.ReactNode}){return <section className="tr-panel"><span className="tr-section-kicker">{eyebrow}</span><h2>{title}</h2>{children}</section>}
function PlatformQaPreview(){
 const [name,setName]=useState("QA Pharma"),[slug,setSlug]=useState("qa-pharma"),[status,setStatus]=useState("active");
 return <div className="tr-grid-wide" data-testid="qa-platform-admin"><Panel eyebrow="FUNCTIONAL QA / PLATFORM" title="Organization lifecycle fields">
  <p className="tr-detail">Authentication and real platform mutations are intentionally deferred. These controls are local-only.</p>
  <div className="tr-form"><TextInput id="qa-platform-name" data-testid="platform-name" labelText="Organization name" value={name} onChange={e=>setName(e.target.value)}/><TextInput id="qa-platform-slug" data-testid="platform-code" labelText="Organization code" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/>
  <label htmlFor="qa-platform-status">Organization status</label><select id="qa-platform-status" data-testid="platform-status" className="tr-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="active">active</option><option value="inactive">inactive</option></select>
  <Button data-testid="platform-validate" disabled={!name.trim()||slug.trim().length<3}>Validate organization fields</Button></div>
 </Panel><Panel eyebrow="FUNCTIONAL QA / AUDIT" title="Administration controls"><div className="tr-check-row"><span>Authentication</span><Tag type="purple">FINAL ENGINEERING SPRINT</Tag></div><div className="tr-check-row"><span>QA mutations</span><Tag type="green">LOCAL ONLY</Tag></div></Panel></div>
}
function OrganizationQaAdmin(){
 const [kind,setKind]=useState("doctors"),[code,setCode]=useState(""),[name,setName]=useState(""),[roleUser,setRoleUser]=useState("");
 return <div className="tr-grid-wide" data-testid="qa-org-admin">
  <Panel eyebrow="ORGANIZATION" title="Hierarchy fields"><div className="tr-form"><TextInput id="org-code" data-testid="org-code" labelText="Unit code" value={code} onChange={e=>setCode(e.target.value)}/><TextInput id="org-name" data-testid="org-name" labelText="Unit name" value={name} onChange={e=>setName(e.target.value)}/><label htmlFor="org-kind">Unit type</label><select id="org-kind" data-testid="org-kind" className="tr-select"><option>company</option><option>division</option><option>zone</option><option>region</option><option>area</option><option>territory</option></select><Button disabled={!code||!name}>Create organization unit</Button></div></Panel>
  <Panel eyebrow="MASTERS" title="Master data fields"><label htmlFor="masters-kind">Master type</label><select id="masters-kind" data-testid="masters-kind" className="tr-select" value={kind} onChange={e=>setKind(e.target.value)}>{["employees","doctors","chemists","stockists","products","samples","gifts"].map(x=><option key={x}>{x}</option>)}</select><p className="tr-detail">Selected: {kind}</p></Panel>
  <Panel eyebrow="ROLE ASSIGNMENT" title="User-role fields"><div className="tr-form"><TextInput id="assign-user" data-testid="assign-user" labelText="Existing user UUID" value={roleUser} onChange={e=>setRoleUser(e.target.value)}/><label htmlFor="assign-role">Role</label><select id="assign-role" data-testid="assign-role" className="tr-select"><option value="MR">Field user</option><option value="MANAGER">Manager</option><option value="TENANT_ADMIN">Organization administrator</option></select><Button disabled={!roleUser}>Assign role</Button></div></Panel>
  <Panel eyebrow="NCA MASTER" title="Category and town fields"><div className="tr-form"><TextInput id="nca-master-code" labelText="Category code" defaultValue="MEETING"/><TextInput id="nca-master-label" labelText="NCA category label" defaultValue="Meeting"/><label htmlFor="nca-town-territory">Town territory</label><select id="nca-town-territory" className="tr-select"><option>Hyderabad Central Territory</option></select><TextInput id="nca-town-name" labelText="Actual town name" defaultValue="Hyderabad"/></div></Panel>
 </div>;
}

export default function App(){
 const data=useTerrevoData(),manager=useManagerCommand(),visit=useVisit(),nca=useNca(),dcr=useDcr();
 const [view,setView]=useState<Area>("overview"),[notice,setNotice]=useState("");
 const api=useMemo(()=>new TerrevoWebApi(()=>{}),[]);
 const tenantId=data.state.organization.id,contextKey="qa|"+data.scenario,territoryId=data.state.territory.id;
 const masters=useMemo<Record<string,Master[]>>(()=>({
  employees:data.state.reps.map(r=>({id:r.id,code:r.id,name:r.name,status:"active",territoryId:r.territoryId})),
  doctors:data.state.doctors.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),territoryId:x.territoryId,specialty:x.specialty,qualification:x.qualification})),
  chemists:data.state.chemists.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),territoryId:x.territoryId})),
  stockists:data.state.stockists.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),territoryId:x.territoryId})),
  products:data.state.products.map(x=>({id:x.id,code:x.code,name:x.name,status:x.status.toLowerCase(),divisionId:x.divisionId})),
  samples:data.state.inventory.filter(x=>x.kind==="SAMPLE").map(x=>({id:x.id,code:x.code,name:x.name,status:"active",productId:x.productId})),
  gifts:data.state.inventory.filter(x=>x.kind!=="SAMPLE").map(x=>({id:x.id,code:x.code,name:x.name,status:"active"})),
 }),[data.state]);
 const legacyLinks=useMemo<LegacyRelationship[]>(()=>data.state.links.map(l=>l.type==="DOCTOR_CHEMIST"?{id:l.id,tenantId,sourceKind:"doctor",sourceId:l.doctorId!,targetKind:"chemist",targetId:l.chemistId,relationship:"DOCTOR_CHEMIST",createdAt:"2026-10-16T00:00:00Z"}:{id:l.id,tenantId,sourceKind:"chemist",sourceId:l.chemistId,targetKind:"stockist",targetId:l.stockistId!,relationship:"CHEMIST_STOCKIST",createdAt:"2026-10-16T00:00:00Z"}),[data.state.links,tenantId]);
 const plan=useMemo<Plan>(()=>{const stops=data.state.visits.map((v,i)=>({sequence:i+1,type:v.customerType.toLowerCase() as "doctor"|"chemist"|"stockist",targetId:v.customerId,remarks:"Functional QA"}));const day:PlanDay={date:"2026-10-16",territoryId,remarks:"Functional QA daily plan",stops};return{id:"qa-plan-provider",weekStart:monday("2026-10-16"),status:"APPROVED",submittedAt:"2026-10-15T18:00:00+05:30",days:[day]}},[data.state.visits,territoryId]);
 const activeVisit=visit.activeVisit;
 const qaProgress:Progress|null=activeVisit?{
  executionId:"qa-execution-01",workDate:"2026-10-16",territoryId,startedAt:activeVisit.checkinAt??"2026-10-16T09:00:00+05:30",serverNow:"2026-10-16T12:00:00+05:30",
  requiredMinutes:480,elapsedMinutes:180,remainingMinutes:300,plannedCount:data.state.visits.length,completedCount:data.state.visits.filter(v=>v.status==="COMPLETED").length,
  inProgressCount:data.state.visits.filter(v=>v.status==="CHECKED_IN").length,pendingCount:data.state.visits.filter(v=>v.status==="PLANNED").length,
  stops:data.state.visits.map((v,i)=>({planStopId:v.id,sequence:i+1,type:v.customerType.toLowerCase() as "doctor"|"chemist"|"stockist",targetId:v.customerId,targetName:v.customerId,status:v.status==="PLANNED"?"PENDING":v.status==="CHECKED_IN"?"IN_PROGRESS":"COMPLETED"}))
 }:null;
 const qaStartOptions:StartOption[]=activeVisit||!data.state.visits.length?[]:[{planId:"qa-plan-provider",planDayId:"qa-day-2026-10-16",workDate:"2026-10-16",territoryId}];
 const qaManager:ManagerCommand={localDate:"2026-10-16",teamMembers:manager.metrics.teamMembers,activeTours:manager.metrics.activeTours,submittedToursToday:manager.metrics.submittedDays,shortDaysToday:data.state.attendance.filter(a=>a.date==="2026-10-16"&&a.status==="SHORT_DAY").length,activeJointWork:0,pending:{tourApprovals:manager.metrics.pendingTourPlans,gpsExceptions:manager.metrics.pendingGpsExceptions,weeklyTimesheets:data.state.timesheets.filter(t=>t.status==="SUBMITTED").length,leaves:manager.metrics.pendingLeaves,expenses:manager.metrics.pendingExpenses}};
 const currentTitle=NAV.find(n=>n.id===view)?.title??"Terrevo";
 const customerHistory=async(kind:"doctor"|"chemist"|"stockist",id:string)=>{
  if(kind==="doctor")return data.state.dcrs.filter(d=>d.visitIds.some(v=>data.state.visits.find(x=>x.id===v)?.customerId===id)).map(d=>({tenantId,customerKind:"doctor" as const,customerId:id,id:d.id,occurredAt:d.submittedAt??d.date+"T18:00:00+05:30",activityType:"DCR" as const,summary:"Submitted DCR"}));
  if(kind==="chemist")return [...data.state.rcpa.filter(r=>r.chemistId===id).map(r=>({tenantId,customerKind:"chemist" as const,customerId:id,id:r.id,occurredAt:r.createdAt,activityType:"RCPA" as const,summary:"RCPA captured"})),...data.state.pob.filter(o=>o.chemistId===id).map(o=>({tenantId,customerKind:"chemist" as const,customerId:id,id:o.id,occurredAt:o.createdAt,activityType:"POB" as const,summary:"POB booked"}))];
  return data.state.pob.filter(o=>o.stockistId===id).map(o=>({tenantId,customerKind:"stockist" as const,customerId:id,id:o.id,occurredAt:o.createdAt,activityType:"POB" as const,summary:"POB booked"}));
 };
 return <div className="tr-app">
  <aside className="tr-sidebar"><div className="tr-brand"><div className="tr-brand-mark">T</div><div><strong>Terrevo</strong><span>Functional QA</span></div></div><nav className="tr-nav" aria-label="Terrevo workspace">{NAV.map(n=><button key={n.id} className={view===n.id?"is-active":""} onClick={()=>{setView(n.id);setNotice("")}}><span>{n.icon}</span><span><strong>{n.title}</strong><small>{n.subtitle}</small></span></button>)}</nav><div className="tr-sidebar-foot"><div className="tr-foot-pill"><span className="tr-foot-dot"/> Functional QA provider</div><p>{data.state.organization.name}<br/>{data.state.territory.name}</p></div></aside>
  <main className="tr-main"><header className="tr-topbar"><div><span className="tr-live"><span/>QA DATA PROVIDER</span><h1>{currentTitle}</h1><p>Scenario: {data.scenario}</p></div><Tag type="purple">NO LOGIN · LOCAL MUTATIONS</Tag></header>
  <div className="tr-page">
   {notice&&<p role="status">{notice}</p>}
   {view==="overview"&&<><div className="tr-metrics"><Metric label="Team members" value={manager.metrics.teamMembers} context="Deterministic QA team"/><Metric label="Active tours" value={manager.metrics.activeTours} context="Derived from visits"/><Metric label="Completed calls" value={manager.metrics.completedCalls} context="Derived from visits"/><Metric label="Pending approvals" value={manager.queue.length} context="Derived manager queue"/></div><div className="tr-grid-wide"><Panel eyebrow="QA STATE" title="Provider-backed domain"><p>All operational data comes from the centralized QA adapter. Change scenarios with the QA drawer.</p><div className="tr-check-row"><span>Authentication</span><Tag type="purple">DEFERRED</Tag></div><div className="tr-check-row"><span>Field mutations</span><Tag type="green">DETERMINISTIC</Tag></div></Panel></div></>}
   {view==="today"&&<TodayIntelligenceView tenantId={tenantId} authorizedForTenantId={tenantId} contextKey={contextKey} progress={qaProgress} startOptions={qaStartOptions} manager={qaManager} todayLocalDate="2026-10-16" onOpenPlan={()=>setView("plans")} onOpenStop={()=>setView("field")}/>} 
   {view==="customers"&&<Customer360View tenantId={tenantId} authorizedForTenantId={tenantId} contextKey={contextKey} masters={{doctors:masters.doctors,chemists:masters.chemists,stockists:masters.stockists}} relationships={legacyLinks} loadHistory={customerHistory} onLinkRelationship={async(sk,sid,tk,tid)=>data.relationships.link(sk,sid,tk,tid)} onUnlinkRelationship={async id=>data.relationships.unlink(id)} onOpenWorkflow={r=>{setNotice("Customer workflow selected: "+r.workflow);setView(r.workflow==="plan"?"plans":"field")}}/>}
   {view==="activities"&&<div className="tr-grid-wide"><ActivitiesView tenantId={tenantId} authorizedForTenantId={tenantId} contextKey={contextKey} territories={[{id:territoryId,name:data.state.territory.name}]} customers={{doctors:masters.doctors,chemists:masters.chemists,stockists:masters.stockists}} plannedCalls={data.state.visits.filter(v=>v.status==="PLANNED").map(v=>({planStopId:v.id,label:(v.customerType+" · "+v.customerId),territoryId:v.territoryId,workDate:"2026-10-16"}))} ncaSubtypes={["MEETING","TRAINING","ADMIN_WORK","CAMP","TRAVEL","LEAVE"].map(code=>({code,label:code.replaceAll("_"," ")}))} towns={["Hyderabad","Secunderabad","Kukatpally","Banjara Hills","Madhapur"].map(name=>({id:name,name}))} defaultWorkDate="2026-10-16" defaultTerritoryId={territoryId} saveMode="HANDOFF" onSaveDraft={async draft=>{if(draft.kind==="NON_CALL_ACTIVITY"){nca.save({repId:"rep-hyd-01",category:draft.ncaSubtype as any,town:draft.townId||"Hyderabad",date:draft.workDate,durationMinutes:draft.durationMinutes,reason:draft.reason,remarks:draft.remarks});setNotice("NCA draft created in provider.")}else setNotice("Activity form validated in QA mode.")}}/><Panel eyebrow="NCA RECORDS" title="State transitions">{nca.records.map(r=><div className="tr-history-row" key={r.id}><div><strong>{r.category} · {r.town}</strong><p>{r.durationMinutes} min · {r.reason}</p></div><Tag type={tagType(r.status)}>{r.status}</Tag>{r.status==="DRAFT"&&<Button size="sm" data-testid={"nca-submit-"+r.id} onClick={()=>nca.submit(r.id)}>Submit</Button>}</div>)}</Panel></div>}
   {view==="edetailing"&&<EDetailingView tenantId={tenantId} authorizedForTenantId={tenantId} contextKey={contextKey} products={masters.products} today="2026-10-16" linkedVisitId={activeVisit?.customerType==="DOCTOR"?activeVisit.id:undefined}/>}
   {view==="field"&&<FunctionalQaFieldExecution/>}
   {view==="plans"&&<MonthlyPlanner api={api} connected functionalQa busy={false} plans={[plan]} units={[{id:territoryId,parentId:null,type:"territory",code:"QA-HYD",name:data.state.territory.name,status:"active"}]} masters={masters} focusCustomer={null} perform={async()=>{setNotice("Planning interaction accepted in QA provider view.")}} onPlanNca={()=>setView("activities")}/>}
   {(["trade","inventory","workforce","reports","approvals"] as Area[]).includes(view)&&<BusinessWorkspace mode={view as BusinessArea} api={api} connected functionalQa manager busy={false} visit={null} progress={null} masters={masters} relationships={legacyLinks} perform={async()=>{}}/>}
   {view==="manager"&&<FunctionalQaManagerCommand/>}
   {view==="admin"&&<OrganizationQaAdmin/>}
   {view==="platform"&&<PlatformQaPreview/>}
  </div>
  <footer className="tr-footer-actions"><div><strong>{data.state.organization.name}</strong><p>Functional QA provider · authentication intentionally deferred</p></div><Tag type="green">SCENARIO READY</Tag></footer></main>
 </div>;
}
