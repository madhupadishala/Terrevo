import { useCallback, useMemo, useRef, useState } from "react";
import { Button, InlineNotification, Tag, TextArea, TextInput, Tile } from "@carbon/react";
import { BusinessWorkspace, type BusinessArea } from "./BusinessWorkspace";
import { PlatformConsole } from "./PlatformConsole";
import { MasterEditor } from "./MasterEditor";
import { MonthlyPlanner } from "./MonthlyPlanner";
import { Customer360View } from "./features/customer360/Customer360View";
import { ActivitiesView } from "./features/activities/ActivitiesView";
import { EDetailingView } from "./features/edetailing/EDetailingView";
import { TodayIntelligenceView } from "./features/intelligence/TodayIntelligenceView";
import { localDate } from "./plan-calendar";
import {
  TerrevoWebApi, freshPosition, type AccessContext, type FieldVisit, type ManagerAnalytics,
  type ManagerCommand, type Master, type OrgUnit, type Plan, type Progress,
  type Session, type StartOption, type Tenant, type NcaOptions, type NcaRecord,
} from "./terrevo-api";

type Area = "overview" | "today" | "customers" | "activities" | "edetailing" | "field" | "plans" | "manager" | "admin" | "platform" | BusinessArea;
type Notice = { kind: "success" | "error" | "info"; title: string; message: string };
const NAV: Array<{ id: Area; title: string; icon: string; subtitle: string }> = [
  { id: "overview", title: "Command overview", icon: "▦", subtitle: "Your real operational activity" },
  { id: "today", title: "Today briefing", icon: "◴", subtitle: "Verified daily agenda and AI-ready insights" },
  { id: "customers", title: "Customer 360", icon: "◎", subtitle: "Authorized doctors, chemists, stockists and customer profiles" },
  { id: "activities", title: "NCA & activities", icon: "▣", subtitle: "Planned, unplanned and non-call activity drafting" },
  { id: "edetailing", title: "E-detailing / CLM", icon: "▧", subtitle: "Approved product content and presentation workspace" },
  { id: "field", title: "Field execution", icon: "⌖", subtitle: "Tour · visits · calls · DCR" },
  { id: "plans", title: "Tour planning", icon: "▤", subtitle: "Weekly plans and approvals" },
  { id: "trade", title: "RCPA & orders", icon: "▥", subtitle: "Chemist and stockist operations" },
  { id: "inventory", title: "Samples & inventory", icon: "▧", subtitle: "Allocated stock and visit distributions" },
  { id: "workforce", title: "Workforce operations", icon: "◷", subtitle: "Timesheets, leave, expenses and joint work" },
  { id: "reports", title: "Daily call reports", icon: "▦", subtitle: "Submitted doctor call records" },
  { id: "manager", title: "Manager command", icon: "◫", subtitle: "Team activity and decisions" },
  { id: "approvals", title: "Manager approvals", icon: "✓", subtitle: "Leave, expenses and timesheet decisions" },
  { id: "admin", title: "Organization admin", icon: "⚙", subtitle: "Organization · masters · roles" },
  { id: "platform", title: "Platform Super Admin", icon: "◇", subtitle: "Platform control plane" },
];
const roles: Record<string, string> = {
  TENANT_ADMIN: "Organization administrator", MANAGER: "Field manager", MR: "Field representative",
};
const MASTER_KINDS = ["employees", "doctors", "chemists", "stockists", "products", "samples", "gifts"];
const dateTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "—";
const errText = (error: unknown) => error instanceof Error ? error.message : "The operation could not be completed.";
const fmt = (v: number | string | null | undefined) => v == null ? "—" : String(v);
const UI_TAG: Record<string, "gray" | "green" | "blue" | "red" | "purple"> = {
  ACTIVE: "green", PENDING: "blue", SUBMITTED: "blue", APPROVED: "green", CHECKED_IN: "blue",
  COMPLETED: "green", CHECKED_OUT: "green", RETURNED: "purple", REJECTED: "red",
};
function Status({ value }: { value: string }) {
  return <Tag type={UI_TAG[value] ?? "gray"}>{value.replace(/_/g, " ")}</Tag>;
}
function FieldMetric({ label, value, context }: { label: string; value: string | number | null | undefined; context: string }) {
  return <Tile className="tr-metric"><p className="tr-metric-label">{label}</p>
    <strong className="tr-metric-number">{fmt(value)}</strong><p className="tr-muted">{context}</p></Tile>;
}
function Panel({ eyebrow, title, children }: { eyebrow: string; title?: string; children: React.ReactNode }) {
  return <section className="tr-panel"><span className="tr-section-kicker">{eyebrow}</span>
    {title && <h2>{title}</h2>}{children}</section>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="tr-empty"><div className="tr-empty-icon" aria-hidden="true">⌖</div><strong>{title}</strong><p>{detail}</p></div>;
}

export default function App() {
  const [view, setView] = useState<Area>("overview");
  const [session, setSession] = useState<Session | null>(null);
  const api = useMemo(() => new TerrevoWebApi(setSession), []);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [access, setAccess] = useState<AccessContext | null>(null);
  const tenantGeneration = useRef(0);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [options, setOptions] = useState<StartOption[]>([]);
  const [visit, setVisit] = useState<FieldVisit | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pending, setPending] = useState<Plan[]>([]);
  const [command, setCommand] = useState<ManagerCommand | null>(null);
  const [analytics, setAnalytics] = useState<ManagerAnalytics | null>(null);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [masters, setMasters] = useState<Record<string, Master[]>>({});
  const [selectedOption, setSelectedOption] = useState("");
  const [stopId, setStopId] = useState("");
  const [gpsReason, setGpsReason] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [callRemarks, setCallRemarks] = useState("");
  const [shortDayReason, setShortDayReason] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [unitType, setUnitType] = useState("company");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitParent, setUnitParent] = useState("");
  const [masterKind, setMasterKind] = useState("doctors");
  const [assignmentUser, setAssignmentUser] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"TENANT_ADMIN" | "MANAGER" | "MR">("MR");
  const [assignmentScope, setAssignmentScope] = useState("");
  const [focusedCustomer, setFocusedCustomer] = useState<{kind:"doctor"|"chemist"|"stockist";id:string;territoryId:string;name:string}|null>(null);
  const [ncaOptions,setNcaOptions] = useState<NcaOptions>({categories:[],towns:[]});
  const [ncaRecords,setNcaRecords] = useState<NcaRecord[]>([]);
  const [ncaCategoryCode,setNcaCategoryCode] = useState("");
  const [ncaCategoryLabel,setNcaCategoryLabel] = useState("");
  const [ncaTownName,setNcaTownName] = useState("");
  const [ncaTownTerritory,setNcaTownTerritory] = useState("");

  function resetTenantState() {
    setProgress(null); setOptions([]); setVisit(null); setPlans([]); setPending([]);
    setCommand(null); setAnalytics(null); setUnits([]); setMasters({});
    setSelectedOption(""); setStopId(""); setGpsReason(""); setCallOutcome("");
    setCallRemarks(""); setShortDayReason("");
    setUnitParent(""); setAssignmentScope(""); setAssignmentUser(""); setReviewComment("");
    setFocusedCustomer(null); setNcaOptions({categories:[],towns:[]}); setNcaRecords([]);
  }

  const connected = Boolean(session && tenantId && access);
  // Independent authorization/role/session epochs ensure feature-local state cannot cross accounts.
  const contextKey = connected
    ? [session!.user.id, tenantId, tenantGeneration.current,
       JSON.stringify(access!.roles), JSON.stringify(access!.permissions)].join("|")
    : "";
  const authorizedForTenantId = connected && !loading ? tenantId : "";
  const admin = access?.roles.some(r => r.roleKey === "TENANT_ADMIN") ?? false;
  const manager = admin || (access?.roles.some(r => r.roleKey === "MANAGER") ?? false);
  const activeStop = progress?.stops.find(s => s.planStopId === visit?.planStopId);

  const refresh = useCallback(async (rights: AccessContext | null) => {
    if (!api.connected) return;
    const generation = tenantGeneration.current;
    setLoading(true);
    try {
      const base = await Promise.allSettled([
        api.progress(), api.startOptions(), api.openVisit(), api.plans(), api.orgUnits(),
        ...MASTER_KINDS.map(k=>api.masters(k)),
        api.ncaOptions(),api.ownNcaRecords(),
      ]);
      if (generation !== tenantGeneration.current) return;
      setProgress(base[0].status==="fulfilled"?base[0].value:null);
      setOptions(base[1].status==="fulfilled"?base[1].value:[]);
      setVisit(base[2].status==="fulfilled"?base[2].value:null);
      setPlans(base[3].status==="fulfilled"?base[3].value:[]);
      setUnits(base[4].status==="fulfilled"?base[4].value:[]);
      const next:Record<string,Master[]>={};
      MASTER_KINDS.forEach((kind,i)=>{
        const result=base[5+i];
        next[kind]=result.status==="fulfilled"?result.value as Master[]:[];
      });
      setMasters(next);
      const ncaOptionsResult=base[5+MASTER_KINDS.length],ncaRowsResult=base[6+MASTER_KINDS.length];
      setNcaOptions(ncaOptionsResult.status==="fulfilled"?ncaOptionsResult.value as NcaOptions:{categories:[],towns:[]});
      setNcaRecords(ncaRowsResult.status==="fulfilled"?ncaRowsResult.value as NcaRecord[]:[]);
      const failures=base.filter(result=>result.status==="rejected").length;
      if (failures) setNotice({kind:"info",title:"Partial data access",
        message:String(failures)+" API requests were denied or unavailable; previous tenant records have been cleared."});
      if (rights?.roles.some(r=>r.roleKey==="TENANT_ADMIN"||r.roleKey==="MANAGER")) {
        const extra=await Promise.allSettled([api.manager(),api.pendingPlans(),api.analytics()]);
        if (generation !== tenantGeneration.current) return;
        setCommand(extra[0].status==="fulfilled"?extra[0].value:null);
        setPending(extra[1].status==="fulfilled"?extra[1].value:[]);
        setAnalytics(extra[2].status==="fulfilled"?extra[2].value:null);
      } else {
        setCommand(null);setPending([]);setAnalytics(null);
      }
    } finally {
      if (generation === tenantGeneration.current) setLoading(false);
    }
  },[api]);

  async function action(fn: () => Promise<unknown>, title: string, shouldRefresh = true) {
    setBusy(true); setNotice(null);
    try {
      await fn();
      if (shouldRefresh) await refresh(access);
      // Keep the confirmed result visible: a partial-refresh warning must not
      // incorrectly replace an accepted business transaction.
      setNotice({ kind: "success", title, message: "The operation was accepted by the Terrevo API." });
    } catch (error) {
      setNotice({ kind: "error", title: "Action could not be completed", message: errText(error) });
    } finally { setBusy(false); }
  }
  async function chooseTenant(id: string) {
    const generation = ++tenantGeneration.current;
    resetTenantState(); setLoading(false);
    setTenantId(""); setAccess(null); api.setTenant(id);
    setBusy(true); setNotice(null);
    try {
      const rights = await api.access();
      if (generation !== tenantGeneration.current) return;
      setTenantId(id); setAccess(rights);
      await refresh(rights);
      setNotice({ kind: "success", title: "Workspace connected", message: "Real business data is loaded under your authorized organization." });
    } catch (error) {
      api.setTenant(null);
      setNotice({ kind: "error", title: "Cannot open organization", message: errText(error) });
    } finally { setBusy(false); }
  }
  async function connect() {
    setBusy(true); setNotice(null);
    try {
      await api.login(email, password);
      setPassword(""); setEmail("");
      const [platformResult, tenantsResult] = await Promise.allSettled([api.platformContext(), api.tenants()]);
      const platformAuthorized = platformResult.status === "fulfilled" && platformResult.value;
      setIsPlatformAdmin(platformAuthorized);
      if (tenantsResult.status === "rejected") throw tenantsResult.reason;
      const available = tenantsResult.value;
      setTenants(available.filter(t=>t.status === "active"));
      if (available.filter(t=>t.status === "active").length === 1) await chooseTenant(available.find(t=>t.status === "active")!.id);
      else if (!available.length && !platformAuthorized) setNotice({ kind: "info", title: "No accessible organization", message: "Your account has no active tenant memberships." });
      else if (!available.length && platformAuthorized) setView("platform");
    } catch (error) {
      api.reset(); setTenants([]); setIsPlatformAdmin(false);
      setNotice({ kind: "error", title: "Connection failed", message: errText(error) });
    } finally { setBusy(false); }
  }
  async function disconnect() {
    ++tenantGeneration.current;
    resetTenantState(); setTenantId(""); setAccess(null);
    setBusy(true);
    try { await api.logout(); }
    catch (error) { setNotice({ kind: "error", title: "Logout encountered a problem", message: errText(error) }); }
    finally {
      setTenantId(""); setAccess(null); setIsPlatformAdmin(false); setTenants([]); setProgress(null); setVisit(null);
      setOptions([]); setPlans([]); setPending([]); setCommand(null); setAnalytics(null);
      setUnits([]); setMasters({}); setBusy(false);
    }
  }
  function guarded(actionFn: () => Promise<unknown>, title: string) {
    if (!connected || busy) return;
    void action(actionFn, title);
  }
  function requireLocation(): Promise<{latitude: number; longitude:number; accuracyMeters:number}> {
    return freshPosition();
  }
  const viewName = NAV.find(n => n.id === view)!;
  const selectedTenantName = tenants.find(t => t.id === tenantId)?.name ?? null;
  return <div className="tr-app">
    <aside className="tr-sidebar" aria-label="Terrevo navigation">
      <div className="tr-brand"><div className="tr-mark">T<span>.</span></div><div><strong>terrevo</strong><small>FIELD INTELLIGENCE</small></div></div>
      <div className="tr-workspace"><span className="tr-workspace-dot" /> {selectedTenantName ?? "PRODUCT WORKSPACE"} </div>
      <p className="tr-nav-label">WORKSPACES</p>
      <nav className="tr-nav" aria-label="Primary">{NAV.map(n=>
        <button key={n.id} type="button" className={view===n.id?"tr-nav-item selected":"tr-nav-item"} aria-current={view===n.id?"page":undefined} onClick={()=>{setView(n.id); setNotice(null);}}>
          <span className="tr-nav-glyph" aria-hidden="true">{n.icon}</span>{n.title}</button>)}</nav>
      <div className="tr-sidebar-foot"><div className="tr-foot-pill"><span className="tr-foot-dot" /> {connected?"Server-connected":"No organization connected"}</div><p>Web · Carbon enterprise UI<br/>Live records only</p></div>
    </aside>
    <div className="tr-main">
      <header className="tr-topbar"><div className="tr-breadcrumb">TERREVO <span>/</span> OPERATIONS <span>/</span> <b>{viewName.title}</b></div>
        <div className="tr-header-right">
          {connected && <Button size="sm" kind="ghost" disabled={busy||loading} onClick={()=>void refresh(access)}>Refresh data</Button>}
          <span className="tr-live"><span />{connected?"LIVE API":"SECURE CONNECTION"}</span>
          <span className="tr-avatar" aria-hidden="true">TR</span>
        </div></header>
      <main className="tr-content" id="main-content">
        <div className="tr-page-heading"><div><p className="tr-eyebrow">TERREVO / PHARMA FIELD OPERATIONS</p>
          <h1>{view==="overview"?"Operations, connected.":viewName.title}</h1><p className="tr-intro">{viewName.subtitle}. No simulated company, employee or transaction data.</p></div>
          <Tag type={connected?"green":"blue"}>{connected?"AUTHORIZED WORKSPACE":"UI / API INTEGRATION"}</Tag>
        </div>
        {notice && <div className="tr-notice" role="status"><InlineNotification lowContrast hideCloseButton kind={notice.kind} title={notice.title} subtitle={notice.message}/></div>}
        {loading && <p className="tr-loading" role="status">Loading authorized Terrevo records…</p>}

        {!connected && <div className="tr-connect-grid">
          <Panel eyebrow="ACCOUNT CONNECTION" title={session?"Choose your organization":"Connect an existing Terrevo account"}>
            <p className="tr-detail">You can explore every workspace without credentials. Live company data and mutations remain protected by the existing identity, RBAC and tenant services. No Super Admin email is required to develop the UI.</p>
            {!session ? <form className="tr-form" onSubmit={e=>{e.preventDefault();void connect();}}>
              <TextInput id="account-email" type="email" labelText="Existing account email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/>
              <TextInput id="account-password" type="password" labelText="Password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/>
              <Button type="submit" disabled={busy||!email||!password}>Connect to live workflows</Button>
            </form> : <div className="tr-form"><label className="tr-select-label" htmlFor="org-select">Active organization</label>
              <select className="tr-select" id="org-select" value={tenantId} onChange={e=>void chooseTenant(e.target.value)} disabled={busy}>
                <option value="">Select organization</option>{tenants.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
              </select>
              <Button kind="ghost" onClick={()=>void disconnect()}>Disconnect session</Button></div>}
          </Panel>
          <Panel eyebrow="SECURITY STATUS" title="Real operations, not a local simulation">
            <div className="tr-check-row"><span>Server data source</span><Tag type="blue">Supabase API</Tag></div>
            <div className="tr-check-row"><span>Access requirements</span><Tag type="green">Enforced</Tag></div>
            <div className="tr-check-row"><span>Organization boundaries</span><Tag type="green">Existing RLS</Tag></div>
            <div className="tr-check-row"><span>Super Admin role</span><Tag type="gray">Backend pending</Tag></div>
            <p className="tr-detail">This application never exposes a service-role token or impersonates an end user.</p>
          </Panel>
        </div>}

        {view==="overview" && <>
          <div className="tr-metrics">
            <FieldMetric label="Active tour" value={!connected?null:progress?"1":"0"} context="From server"/>
            <FieldMetric label="Visits completed" value={progress?.completedCount??null} context="Current tour"/>
            <FieldMetric label="Planned stops" value={progress?.plannedCount??null} context="Approved work"/>
            <FieldMetric label="Pending approvals" value={manager?command?.pending.tourApprovals:null} context="Manager queue"/>
          </div>
          <div className="tr-grid-wide">
            <Panel eyebrow="FIELD CONTROL" title={progress?"Today's tour is in progress":"Your next field assignment"}>
              {progress?<><p className="tr-detail">Started {dateTime(progress.startedAt)} · {progress.workDate}</p>
                <p className="tr-detail">{progress.completedCount} of {progress.plannedCount} stops completed · {progress.remainingMinutes} minutes remaining at last refresh.</p>
                <Button onClick={()=>setView("field")}>Continue field execution ↗</Button></>:
                <><p className="tr-detail">{connected?"No active tour was returned for this account. Start from an approved tour day.":"Connect an authorized account to retrieve approved tour assignments."}</p><Button kind="primary" onClick={()=>setView("field")}>Open field execution ↗</Button></>}
            </Panel>
            <Panel eyebrow="ROLE-AWARE OPERATIONS" title="Workspace access">
              <div className="tr-check-row"><span>Field execution</span><Tag type={connected?"green":"blue"}>{connected?"Available":"Connect first"}</Tag></div>
              <div className="tr-check-row"><span>Manager command</span><Tag type={manager?"green":"gray"}>{manager?"Authorized":"Permission-gated"}</Tag></div>
              <div className="tr-check-row"><span>Organization administration</span><Tag type={admin?"green":"gray"}>{admin?"Authorized":"Permission-gated"}</Tag></div>
              <div className="tr-check-row"><span>Platform Super Admin</span><Tag type="gray">Separate authorization required</Tag></div>
            </Panel>
          </div>
        </>}

        {view==="field" && focusedCustomer && <p className="tr-detail" role="status">Customer 360 selection: <strong>{focusedCustomer.name}</strong>. Only an authorized pending stop from the approved tour can be checked in.</p>}
        {view==="field" && <div className="tr-grid-wide">
          <Panel eyebrow="FIELD EXECUTION / REAL API" title={progress?"Tour in progress":"Start My Tour"}>
            {progress?<><div className="tr-section-line"><p>{progress.workDate} · {dateTime(progress.startedAt)}</p><Tag type="green">ACTIVE</Tag></div>
              <div className="tr-tour-stats"><div><span>COMPLETED</span><strong>{progress.completedCount}/{progress.plannedCount}</strong></div><div><span>REMAINING</span><strong>{progress.remainingMinutes} minutes</strong></div></div>
              {visit?<><h3>On-site visit</h3><p className="tr-detail">{activeStop?.targetName??visit.planStopId} · {visit.verification}</p>
                <Status value={visit.exceptionStatus}/>
                <div className="tr-form"><TextInput id="call-outcome" labelText="Call outcome" value={callOutcome} onChange={e=>setCallOutcome(e.target.value)} maxLength={120}/>
                  <TextArea id="call-remarks" labelText="Remarks" value={callRemarks} onChange={e=>setCallRemarks(e.target.value)} maxLength={2000}/>
                  <Button kind="secondary" disabled={!connected||busy||!callOutcome.trim()||!activeStop} onClick={()=>guarded(()=>activeStop?.type==="doctor"?api.doctorCall(visit.id,callOutcome,callRemarks||null):api.tradeCall(visit.id,callOutcome,callRemarks||null),"Call outcome saved")}>Save call outcome</Button>
                  <Button disabled={!connected||busy} onClick={()=>guarded(async()=>api.checkOut(visit.id,await requireLocation()),"Checked out of field visit")}>Check out with location</Button></div>
              </>:<><p className="tr-detail">Select an approved stop; check-in captures a fresh device location.</p>
                <div className="tr-form"><label className="tr-select-label" htmlFor="stop-select">Next stop</label>
                  <select className="tr-select" id="stop-select" value={stopId} onChange={e=>setStopId(e.target.value)}>
                    <option value="">Select pending stop</option>{progress.stops.filter(s=>s.status!=="COMPLETED").map(s=><option key={s.planStopId} value={s.planStopId}>{s.sequence}. {s.targetName} ({s.type})</option>)}
                  </select>
                  <TextInput id="gps-reason" labelText="GPS exception reason (only if applicable)" value={gpsReason} onChange={e=>setGpsReason(e.target.value)} maxLength={1000}/>
                  <Button disabled={!connected||busy||!stopId} onClick={()=>guarded(async()=>api.checkIn(stopId,await requireLocation(),gpsReason||null),"Field check-in saved")}>Check in using device GPS</Button></div></>}
              <div className="tr-form"><TextInput id="short-reason" labelText="Short-day explanation (if required)" value={shortDayReason} onChange={e=>setShortDayReason(e.target.value)} maxLength={1000}/>
                <Button kind="tertiary" disabled={!connected||busy||Boolean(visit)} onClick={()=>guarded(()=>api.submitTour(shortDayReason||null),"Tour submitted")}>Submit My Tour</Button></div>
            </>:<><p className="tr-detail">{connected?"Only approved, assigned tour days can be started.":"Connect an account to retrieve approved tour days."}</p>
              <div className="tr-form"><label className="tr-select-label" htmlFor="approved-day">Approved work date</label>
                <select className="tr-select" id="approved-day" value={selectedOption} onChange={e=>setSelectedOption(e.target.value)} disabled={!connected}>
                  <option value="">Select approved tour day</option>{options.map(o=><option value={o.planDayId} key={o.planDayId}>{o.workDate} · {units.find(u=>u.id===o.territoryId)?.name??o.territoryId}</option>)}
                </select>
                <Button disabled={!connected||busy||!selectedOption} onClick={()=>guarded(async()=>api.startTour(selectedOption,await requireLocation()),"Tour started")}>Start My Tour (GPS)</Button></div>
              {connected&&options.length===0&&<Empty title="No approved tour day" detail="Create a weekly tour plan and have an authorized manager approve it first."/>}
            </>}
          </Panel>
          <Panel eyebrow="TOUR WORKLIST" title="Visit execution queue">
            {progress?.stops.length? <div className="tr-visit-list">{progress.stops.map(s=><div className="tr-visit-row" key={s.planStopId}>
              <span className="tr-row-icon">{s.sequence}</span><div><strong>{s.targetName}</strong><p>{s.type}</p></div><Status value={s.status}/></div>)}</div>:
              <Empty title="No active route" detail="The visit worklist is populated from the authorized tour-progress API."/>}
          </Panel>
        </div>}

        {view==="today" && <TodayIntelligenceView
          key={contextKey || "disconnected"} tenantId={tenantId} authorizedForTenantId={authorizedForTenantId}
          contextKey={contextKey} progress={progress} startOptions={options} manager={manager?command:null}
          loading={loading} todayLocalDate={localDate()}
          onOpenPlan={()=>setView("plans")}
          onOpenStop={id=>{setStopId(id);setView("field");}} />}

        {view==="customers" && <Customer360View
          key={contextKey || "disconnected"} tenantId={tenantId} authorizedForTenantId={authorizedForTenantId}
          contextKey={contextKey} masters={{doctors:masters.doctors??[],chemists:masters.chemists??[],stockists:masters.stockists??[]}}
          loading={loading}
          onOpenWorkflow={request=>{
            if(!connected)return;
            const group=masters[request.customerType==="doctor"?"doctors":request.customerType==="chemist"?"chemists":"stockists"]??[];
            const record=group.find(m=>m.id===request.customerId&&m.status==="active"&&typeof m.territoryId==="string");
            if(!record)return;
            const customer={kind:request.customerType,id:record.id,territoryId:String(record.territoryId),name:record.name};
            setFocusedCustomer(customer);
            if(request.workflow==="field"){
              const authorizedStop=progress?.stops.find(x=>x.targetId===record.id&&x.type===request.customerType&&x.status!=="COMPLETED");
              if(authorizedStop){setStopId(authorizedStop.planStopId);setView("field");return;}
              setNotice({kind:"info",title:"Approved stop required",message:"This customer is not a pending stop on the active approved tour. Add them to a plan and obtain approval before execution."});
            }
            setView("plans");
          }} />}

        {view==="activities" && <ActivitiesView
          key={contextKey || "disconnected"} tenantId={tenantId} authorizedForTenantId={authorizedForTenantId}
          contextKey={contextKey}
          territories={units.filter(u=>u.type==="territory"&&u.status==="active").map(u=>({id:u.id,name:u.name}))}
          customers={{doctors:masters.doctors??[],chemists:masters.chemists??[],stockists:masters.stockists??[]}}
          plannedCalls={progress?.stops.map(stop=>({
            planStopId:stop.planStopId, label:stop.targetName, territoryId:progress.territoryId, workDate:progress.workDate,
          }))??[]}
          saveMode="SERVER_NCA"
          ncaSubtypes={ncaOptions.categories.map(x=>({code:x.code,label:x.label}))}
          towns={ncaOptions.towns.map(x=>({id:x.id,name:x.name}))}
          onSaveDraft={async draft=>{
            if(!connected||draft.tenantId!==tenantId)throw new Error("The organization changed; start a new authorized draft.");
            if(draft.kind!=="NON_CALL_ACTIVITY")throw new Error("Planned and unplanned calls must use their approved tour workflows; the separate backend contract is not yet available.");
            if(draft.evidence)throw new Error("NCA evidence uploads are not supported. Remove the unverified reference before saving.");
            await api.saveNcaDraft({phase:draft.ncaPhase==="PLAN"?"PLAN":"REPORT",
              workDate:draft.workDate,territoryId:draft.territoryId,categoryCode:draft.ncaSubtype??"",
              townId:draft.townId??null,reason:draft.reason,remarks:draft.remarks,durationMinutes:draft.durationMinutes});
            await refresh(access);
          }}
          loading={loading} />}
        {view==="activities"&&connected&&<Panel eyebrow="SERVER RECORDS" title="My NCA drafts and reports">
          {ncaRecords.length?ncaRecords.map(record=><div className="tr-history-row" key={record.id}>
            <div><strong>{record.workDate} · {record.phase} · {record.categoryCode}</strong>
              <p>{record.reason} · {record.durationMinutes} minutes</p></div>
            <Status value={record.status}/>
            {record.status==="DRAFT"&&<Button size="sm" disabled={busy||loading}
              onClick={()=>guarded(()=>api.submitNca(record.id),"NCA report submitted")}>Submit NCA</Button>}
          </div>):<p className="tr-detail">No NCA records returned by the tenant API. Create an authorized draft above.</p>}
        </Panel>}

        {view==="edetailing" && <EDetailingView
          key={contextKey || "disconnected"} tenantId={tenantId} authorizedForTenantId={authorizedForTenantId}
          contextKey={contextKey} products={masters.products??[]} assets={[]} today={localDate()}
          linkedVisitId={visit?.id} loading={loading} />}

        {view==="plans" && <MonthlyPlanner key={[contextKey,focusedCustomer?.kind??"",focusedCustomer?.id??""].join(":")}
          api={api} connected={connected} busy={busy} plans={plans} units={units} masters={masters}
          focusCustomer={focusedCustomer} perform={(fn,title)=>action(fn,title)} />}

        {(["trade","inventory","workforce","approvals","reports"] as Area[]).includes(view) &&
          <BusinessWorkspace key={tenantId} mode={view as BusinessArea} api={api} connected={connected} manager={manager} busy={busy}
            visit={visit} progress={progress} masters={masters} perform={(fn,title)=>action(fn,title)} />}

        {view==="manager"&&(manager?
          <><div className="tr-metrics">
            <FieldMetric label="Field team members" value={command?.teamMembers} context="Authorized team"/>
            <FieldMetric label="Active tours" value={command?.activeTours} context="Currently executing"/>
            <FieldMetric label="Today's submissions" value={command?.submittedToursToday} context="Server-reported"/>
            <FieldMetric label="Pending approvals" value={command?.pending.tourApprovals} context="Tour decisions"/>
          </div><div className="tr-grid-wide">
            <Panel eyebrow="DECISION QUEUE" title="Tour approvals">
              {pending.length?pending.map(p=><div className="tr-history-row" key={p.id}><div><strong>Week of {p.weekStart}</strong><p>Plan {p.id.slice(0,8)}</p>
                <div className="tr-button-row"><Button size="sm" disabled={busy} onClick={()=>guarded(()=>api.decidePlan(p.id,"APPROVE",null),"Tour plan approved")}>Approve</Button>
                  <Button size="sm" kind="secondary" disabled={busy||!reviewComment.trim()} onClick={()=>guarded(()=>api.decidePlan(p.id,"RETURN",reviewComment),"Plan returned")}>Return</Button></div>
              </div><Status value={p.status}/></div>):<Empty title="No pending plans" detail="Only plans awaiting your permitted review appear here."/>}
              <TextArea id="approval-comment" labelText="Return / rejection comment" value={reviewComment} onChange={e=>setReviewComment(e.target.value)} maxLength={1000}/>
            </Panel>
            <Panel eyebrow="MANAGER ANALYTICS" title="Rolling 7-day operations"><div className="tr-check-row"><span>Submitted tours</span><strong>{fmt(analytics?.tours.submitted)}</strong></div>
              <div className="tr-check-row"><span>Planned stops</span><strong>{fmt(analytics?.coverage.plannedStops)}</strong></div>
              <div className="tr-check-row"><span>Completed visits</span><strong>{fmt(analytics?.coverage.completedVisits)}</strong></div>
              <div className="tr-check-row"><span>Doctor calls</span><strong>{fmt(analytics?.coverage.doctorCalls)}</strong></div>
              <div className="tr-check-row"><span>Pending GPS exceptions</span><strong>{fmt(command?.pending.gpsExceptions)}</strong></div>
            </Panel>
          </div></>:
          <Panel eyebrow="MANAGER ACCESS" title="Manager workspace is permission-gated"><p className="tr-detail">The actual manager command and approval APIs only permit an authorized manager or tenant administrator. No fake results are displayed.</p></Panel>)}

        {view==="admin"&&(admin?<div className="tr-grid-wide">
          <Panel eyebrow="ORGANIZATION STRUCTURE" title="Manage reporting hierarchy">
            <div className="tr-form"><TextInput id="org-code" labelText="Unit code" value={unitCode} onChange={e=>setUnitCode(e.target.value)}/>
              <TextInput id="org-name" labelText="Unit name" value={unitName} onChange={e=>setUnitName(e.target.value)}/>
              <label className="tr-select-label" htmlFor="org-kind">Unit type</label><select className="tr-select" id="org-kind" value={unitType} onChange={e=>setUnitType(e.target.value)}>
                {["company","division","zone","region","area","territory"].map(t=><option value={t} key={t}>{t}</option>)}</select>
              {unitType!=="company"&&<><label className="tr-select-label" htmlFor="org-parent">Parent organization unit</label><select className="tr-select" id="org-parent" value={unitParent} onChange={e=>setUnitParent(e.target.value)}>
                <option value="">Select parent</option>{units.map(u=><option key={u.id} value={u.id}>{u.type} · {u.name}</option>)}</select></>}
              <Button disabled={busy||!unitCode.trim()||!unitName.trim()||(unitType!=="company"&&!unitParent)} onClick={()=>guarded(()=>api.createOrgUnit({type:unitType,code:unitCode,name:unitName,parentId:unitType==="company"?null:unitParent}),"Organization unit created")}>Create organization unit</Button></div>
            <div className="tr-list-sm">{units.map(u=><div className="tr-history-row" key={u.id}><div><strong>{u.name}</strong><p>{u.type} · {u.code}</p></div><Status value={u.status.toUpperCase()}/></div>)}</div>
          </Panel>
          <Panel eyebrow="MASTER DATA & ACCESS" title="Business administration">
            <label className="tr-select-label" htmlFor="masters-kind">Master type</label><select id="masters-kind" className="tr-select" value={masterKind} onChange={e=>setMasterKind(e.target.value)}>
              {MASTER_KINDS.map(kind=><option value={kind} key={kind}>{kind}</option>)}</select>
            <div className="tr-list-sm">{(masters[masterKind]??[]).map(m=><div className="tr-history-row" key={m.id}><div><strong>{m.name}</strong><p>{m.code}</p></div><Status value={m.status.toUpperCase()}/></div>)}</div>
            <MasterEditor key={tenantId} kind={masterKind} units={units} products={masters.products??[]} disabled={!connected||busy}
              perform={input=>action(()=>api.createMaster(masterKind,input),"Master record created")}/>
            <h3>Assign an existing user</h3><div className="tr-form"><TextInput id="assign-user" labelText="Existing user UUID" value={assignmentUser} onChange={e=>setAssignmentUser(e.target.value)}/>
              <label className="tr-select-label" htmlFor="assign-role">Role</label><select className="tr-select" id="assign-role" value={assignmentRole} onChange={e=>setAssignmentRole(e.target.value as typeof assignmentRole)}>
                <option value="MR">Field user</option><option value="MANAGER">Manager</option><option value="TENANT_ADMIN">Organization administrator</option></select>
              {assignmentRole!=="TENANT_ADMIN"&&<><label className="tr-select-label" htmlFor="assign-scope">Organization scope</label>
                <select className="tr-select" id="assign-scope" value={assignmentScope} onChange={e=>setAssignmentScope(e.target.value)}>
                  <option value="">Select authorized unit</option>{units.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select></>}
              <Button disabled={busy||!assignmentUser||(!assignmentScope&&assignmentRole!=="TENANT_ADMIN")} onClick={()=>guarded(()=>api.assignRole(assignmentUser,assignmentRole,assignmentRole==="TENANT_ADMIN"?null:assignmentScope),"Role assignment saved")}>Assign role</Button></div>
          </Panel>
        </div>:<Panel eyebrow="ADMIN PERMISSIONS" title="Tenant administration requires authorization"><p className="tr-detail">This area uses existing real organization and role APIs. It does not grant elevated access to a regular field user.</p></Panel>)}

        {view==="admin"&&admin&&<Panel eyebrow="CONTROLLED NCA MASTER" title="Manage NCA categories and towns">
          <p className="tr-detail">NCA types and towns are client-controlled records; Terrevo does not invent categories or towns.</p>
          <div className="tr-form">
            <TextInput id="nca-master-code" labelText="Category code (UPPERCASE_UNDERSCORES)" maxLength={40}
              value={ncaCategoryCode} onChange={e=>setNcaCategoryCode(e.target.value)}/>
            <TextInput id="nca-master-label" labelText="NCA category label" maxLength={120}
              value={ncaCategoryLabel} onChange={e=>setNcaCategoryLabel(e.target.value)}/>
            <Button size="sm" disabled={!connected||busy||!ncaCategoryCode||!ncaCategoryLabel}
              onClick={()=>guarded(()=>api.configureNcaCategory(ncaCategoryCode,ncaCategoryLabel),"NCA category configured")}>Save category</Button>
            <label className="tr-select-label" htmlFor="nca-town-territory">Town territory</label>
            <select id="nca-town-territory" className="tr-select" value={ncaTownTerritory} onChange={e=>setNcaTownTerritory(e.target.value)}>
              <option value="">Select authorized territory</option>
              {units.filter(x=>x.type==="territory"&&x.status==="active").map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <TextInput id="nca-town-name" labelText="Actual town name" maxLength={120} value={ncaTownName}
              onChange={e=>setNcaTownName(e.target.value)}/>
            <Button size="sm" disabled={!connected||busy||!ncaTownTerritory||!ncaTownName}
              onClick={()=>guarded(()=>api.configureNcaTown(ncaTownTerritory,ncaTownName),"NCA town configured")}>Save town</Button>
          </div>
          <p className="tr-detail">{ncaOptions.categories.length} approved NCA categories · {ncaOptions.towns.length} authorized towns</p>
        </Panel>}

        {view==="platform"&&<PlatformConsole api={api} authenticated={Boolean(session)}
          isSuperAdmin={isPlatformAdmin} busy={busy} perform={(fn,title)=>action(fn,title,false)}/>}

        {connected&&<div className="tr-footer-actions"><div><strong>{selectedTenantName}</strong>
          <p>{access?.roles.map(r=>roles[r.roleKey]??r.roleKey).join(" · ")||"No assigned roles"}</p></div>
          {tenants.length>1&&<select className="tr-select" aria-label="Switch organization" value={tenantId} disabled={busy||loading} onChange={e=>void chooseTenant(e.target.value)}>{tenants.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select>}
          <Button kind="ghost" onClick={()=>void disconnect()} disabled={busy}>Disconnect</Button></div>}
        <footer className="tr-footer"><span>TERREVO / PHARMA FIELD INTELLIGENCE</span><span>Server-backed business workflows · platform administration separately authorized</span></footer>
      </main>
    </div>
  </div>;
}
