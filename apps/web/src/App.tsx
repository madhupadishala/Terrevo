import { useEffect, useMemo, useState } from "react";
import {
  Button, InlineNotification, Tag, TextArea, TextInput, Tile,
} from "@carbon/react";
import {
  activeTour, checkIn, checkOut, emptyWorkspace, openVisit, readWorkspace, saveNotes,
  startTour, STORAGE_KEY, submitTour, type VisitType, type Workspace,
} from "./workspace";

type View = "overview" | "tours" | "visits" | "insights" | "integration";
type Health = {
  status: "ok" | "degraded";
  apiAdapter: string;
  provider: { identity: string; serverMutations: string };
};

const NAV: Array<{ id: View; label: string; short: string }> = [
  { id: "overview", label: "Command overview", short: "Overview" },
  { id: "tours", label: "My tours", short: "Tours" },
  { id: "visits", label: "Field visits", short: "Visits" },
  { id: "insights", label: "Activity intelligence", short: "Insights" },
  { id: "integration", label: "Connections & safety", short: "Connections" },
];

const LABEL: Record<VisitType, string> = {
  DOCTOR: "Doctor", CHEMIST: "Chemist", STOCKIST: "Stockist",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, {
    dateStyle: "medium", timeStyle: "short",
  });
}

function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try { return readWorkspace(window.localStorage); }
    catch { return emptyWorkspace(); }
  });
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }
    catch { setStorageWarning(true); }
  }, [workspace]);
  return { workspace, setWorkspace, storageWarning };
}

function Metric({ label, value, context }: { label: string; value: string | number; context: string }) {
  return <Tile className="tr-metric">
    <p className="tr-metric-label">{label}</p>
    <strong className="tr-metric-number">{value}</strong>
    <p className="tr-muted">{context}</p>
  </Tile>;
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const { workspace, setWorkspace, storageWarning } = useWorkspace();
  const [health, setHealth] = useState<Health | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [territory, setTerritory] = useState("");
  const [account, setAccount] = useState("");
  const [visitType, setVisitType] = useState<VisitType>("DOCTOR");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("API health check failed");
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch(() => { if (!controller.signal.aborted) setApiUnavailable(true); });
    return () => controller.abort();
  }, []);

  const active = activeTour(workspace);
  const currentVisit = openVisit(workspace);
  useEffect(() => { setNotes(currentVisit?.notes ?? ""); }, [currentVisit?.id]);
  const activeVisits = active ? workspace.visits.filter((visit) => visit.tourId === active.id) : [];
  const completedVisits = workspace.visits.filter((visit) => visit.status === "CHECKED_OUT");
  const submittedTours = workspace.tours.filter((tour) => tour.status === "SUBMITTED");
  const recentVisits = workspace.visits.slice(0, 6);
  const names = useMemo(
    () => new Set(workspace.visits.map((visit) => visit.account.toLocaleLowerCase())).size,
    [workspace.visits],
  );

  function apply(change: () => Workspace, message: string) {
    try {
      setWorkspace(change());
      setNotice({ kind: "success", message });
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Action could not be completed." });
    }
  }
  function handleStart() {
    apply(() => startTour(workspace, territory, crypto.randomUUID(), new Date().toISOString()), "Tour started in this local workspace.");
    if (!active && territory.trim().length >= 2) setTerritory("");
  }
  function handleCheckIn() {
    apply(() => checkIn(workspace, account, visitType, crypto.randomUUID(), new Date().toISOString()), "Visit check-in recorded locally.");
    if (active && !currentVisit && account.trim().length >= 2) { setAccount(""); setNotes(""); }
  }
  function handleCheckOut() {
    if (!currentVisit) return;
    apply(() => checkOut(workspace, currentVisit.id, new Date().toISOString()), "Visit check-out recorded locally.");
    setNotes("");
  }
  const countByType = (type: VisitType) => workspace.visits.filter(v => v.type === type).length;

  return (
    <div className="tr-app">
      <aside className="tr-sidebar" aria-label="Application navigation">
        <div className="tr-brand"><div className="tr-mark">T<span>.</span></div><div><strong>terrevo</strong><small>FIELD INTELLIGENCE</small></div></div>
        <div className="tr-workspace"><span className="tr-workspace-dot" /> LOCAL WORKSPACE <span className="tr-chevron">⌄</span></div>
        <p className="tr-nav-label">OPERATIONS</p>
        <nav className="tr-nav" aria-label="Primary">
          {NAV.map((item, i) => <button key={item.id} type="button" className={view === item.id ? "tr-nav-item selected" : "tr-nav-item"} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setNotice(null); }}>
            <span className="tr-nav-glyph" aria-hidden="true">{["▦", "▤", "⌖", "◫", "⚙"][i]}</span>{item.label}
          </button>)}
        </nav>
        <div className="tr-sidebar-foot">
          <div className="tr-foot-pill"><span className="tr-foot-dot" /> Browser-only mode</div>
          <p>Operational web workspace<br/>Wave 1 · No sign-in</p>
        </div>
      </aside>

      <div className="tr-main">
        <header className="tr-topbar">
          <div className="tr-breadcrumb">TERREVO <span>/</span> FIELD OPERATIONS <span>/</span> <b>{NAV.find(n => n.id === view)?.short}</b></div>
          <div className="tr-header-right"><span className="tr-live"><span /> LOCAL MODE</span><span className="tr-avatar" aria-hidden="true">TR</span></div>
        </header>

        <main className="tr-content" id="main-content">
          <div className="tr-page-heading">
            <div><p className="tr-eyebrow">FIELD EXECUTION PLATFORM / WAVE 01</p>
              <h1>{view === "overview" ? "Your field, in focus." : NAV.find(n => n.id === view)?.label}</h1>
              <p className="tr-intro">{view === "overview" ? "A single command space for tour activity, visits and operational momentum." :
                view === "tours" ? "Plan your day, start a tour and record its completion." :
                view === "visits" ? "Capture field interactions and keep each visit accounted for." :
                view === "insights" ? "Live totals computed from your browser-local workspace." :
                "Understand which services are configured and what this environment can safely do."}</p>
            </div>
            <Tag type="blue">WAVE 1 · WORKSPACE</Tag>
          </div>

          <InlineNotification kind="info" lowContrast hideCloseButton
            title="Protected development boundary"
            subtitle="No login screen. Tour and visit actions are saved on this browser only, not to Supabase. Do not enter personal or customer data. API write operations remain protected." />
          {storageWarning && <InlineNotification kind="error" lowContrast hideCloseButton title="Local storage unavailable" subtitle="Changes may disappear when this page reloads." />}
          {notice && <div className="tr-notice" role="status"><InlineNotification kind={notice.kind} lowContrast hideCloseButton title={notice.kind === "success" ? "Recorded" : "Action blocked"} subtitle={notice.message} /></div>}

          {view === "overview" && <>
            <section className="tr-metrics" aria-label="Local activity overview">
              <Metric label="Active tour" value={active ? "01" : "00"} context={active ? active.territory : "Ready when you are"} />
              <Metric label="Visits recorded" value={workspace.visits.length.toString().padStart(2, "0")} context={completedVisits.length + " checked out"} />
              <Metric label="Accounts covered" value={names.toString().padStart(2, "0")} context="Unique visit accounts" />
              <Metric label="Tours submitted" value={submittedTours.length.toString().padStart(2, "0")} context="Recorded locally" />
            </section>
            <div className="tr-grid-wide">
              <section className="tr-panel tr-mission">
                <div className="tr-section-line"><span className="tr-section-kicker">TODAY'S MISSION</span><Tag type={active ? "green" : "gray"}>{active ? "In progress" : "Not started"}</Tag></div>
                <h2>{active ? active.territory : "Ready to take the field?"}</h2>
                <p>{active ? "Your tour is active. Every recorded visit builds your field activity timeline." : "Start a tour to activate visit recording and create your first operational timeline."}</p>
                {active ? <div className="tr-tour-stats"><div><span>STARTED</span><strong>{formatTime(active.startAt)}</strong></div><div><span>VISITS</span><strong>{activeVisits.length}</strong></div></div> : <div className="tr-empty-lines"><span /><span /><span /></div>}
                <Button onClick={() => setView(active ? "visits" : "tours")} className="tr-action">{active ? "Record a field visit" : "Start your first tour"} <span aria-hidden="true">↗</span></Button>
              </section>
              <section className="tr-panel tr-secondary-panel">
                <span className="tr-section-kicker">WORKSPACE STATUS</span>
                <h3>Operational foundations</h3>
                <div className="tr-check-row"><span className="tr-tick">✓</span> Local lifecycle engine <Tag type="green">Available</Tag></div>
                <div className="tr-check-row"><span className="tr-tick">✓</span> Persistent browser records <Tag type="green">Available</Tag></div>
                <div className="tr-check-row"><span className="tr-tick">○</span> Supabase business writes <Tag type="gray">Protected</Tag></div>
                <div className="tr-check-row"><span className="tr-tick">○</span> Identity / RBAC UI <Tag type="gray">Deferred</Tag></div>
                <Button kind="ghost" size="sm" onClick={() => setView("integration")}>View connection details ↗</Button>
              </section>
            </div>
            <section className="tr-panel tr-activity"><div className="tr-section-line"><div><span className="tr-section-kicker">ACTIVITY STREAM</span><h3>Recent field interactions</h3></div><Button kind="ghost" size="sm" onClick={() => setView("visits")}>View all ↗</Button></div>
              {recentVisits.length === 0 ? <div className="tr-empty"><div className="tr-empty-icon">⌖</div><strong>No activity recorded yet</strong><p>Field visits will appear here as you check in to accounts.</p></div> :
                <div className="tr-visit-list">{recentVisits.map(visit => <div className="tr-visit-row" key={visit.id}><span className="tr-row-icon">{LABEL[visit.type].charAt(0)}</span><div><strong>{visit.account}</strong><p>{LABEL[visit.type]} · {formatTime(visit.checkinAt)}</p></div><Tag type={visit.status === "CHECKED_OUT" ? "green" : "blue"}>{visit.status === "CHECKED_OUT" ? "Completed" : "On site"}</Tag></div>)}</div>}
            </section>
          </>}

          {view === "tours" && <div className="tr-grid-wide">
            <section className="tr-panel">
              <span className="tr-section-kicker">TOUR CONTROL</span>
              {active ? <><h2>{active.territory}</h2><Tag type="green">Active field tour</Tag><p className="tr-detail">Started {formatTime(active.startAt)}</p><p className="tr-detail">{activeVisits.length} field visits · {activeVisits.filter(v => v.status === "CHECKED_OUT").length} completed</p>
                <Button kind="primary" disabled={Boolean(currentVisit)} onClick={() => apply(() => submitTour(workspace, new Date().toISOString()), "Tour submitted to local activity history.")}>Submit tour</Button>
                {currentVisit && <p className="tr-hint">Check out from the open visit before submitting.</p>}
              </> : <><h2>Start My Tour</h2><p className="tr-detail">Begin a new field day. Only one tour can be active at once.</p><div className="tr-form"><TextInput id="tour-territory" labelText="Territory or working area" placeholder="e.g. Central Zone" value={territory} onChange={e => setTerritory(e.target.value)} maxLength={100}/><Button onClick={handleStart}>Start tour ↗</Button></div></>}
            </section>
            <section className="tr-panel"><span className="tr-section-kicker">TOUR HISTORY</span><h3>Previous tours</h3>
              {workspace.tours.length === 0 ? <p className="tr-detail">Your first completed tour will appear here.</p> : workspace.tours.map(tour => <div className="tr-history-row" key={tour.id}><div><strong>{tour.territory}</strong><p>{formatTime(tour.startAt)}</p></div><Tag type={tour.status === "ACTIVE" ? "blue" : "green"}>{tour.status === "ACTIVE" ? "Active" : "Submitted"}</Tag></div>)}
            </section>
          </div>}

          {view === "visits" && <div className="tr-grid-wide">
            <section className="tr-panel"><span className="tr-section-kicker">VISIT EXECUTION</span><h2>{currentVisit ? "Visit in progress" : "Check in to an account"}</h2>
              {currentVisit ? <><div className="tr-highlight-visit"><Tag type="blue">On site</Tag><h3>{currentVisit.account}</h3><p>{LABEL[currentVisit.type]} · Checked in {formatTime(currentVisit.checkinAt)}</p></div><div className="tr-form"><TextArea id="visit-notes" labelText="Field notes (local only)" placeholder="Record a non-sensitive call outcome" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000}/><div className="tr-button-row"><Button kind="secondary" onClick={() => apply(() => saveNotes(workspace, currentVisit.id, notes), "Visit notes saved.")}>Save notes</Button><Button onClick={handleCheckOut}>Check out</Button></div></div></> :
                <div className="tr-form"><p className="tr-detail">{active ? "Record your next account visit." : "Start a tour before checking in to a visit."}</p><TextInput id="visit-account" labelText="Account / HCP display name" placeholder="Enter a non-sensitive test account" value={account} onChange={e => setAccount(e.target.value)} disabled={!active} maxLength={160}/>
                  <label className="tr-select-label" htmlFor="visit-type">Visit category</label><select className="tr-select" id="visit-type" value={visitType} disabled={!active} onChange={e => setVisitType(e.target.value as VisitType)}><option value="DOCTOR">Doctor</option><option value="CHEMIST">Chemist</option><option value="STOCKIST">Stockist</option></select>
                  <Button onClick={handleCheckIn} disabled={!active}>Record check-in ↗</Button></div>}
            </section>
            <section className="tr-panel"><span className="tr-section-kicker">VISIT LEDGER</span><h3>All recorded visits</h3>
              {workspace.visits.length === 0 ? <p className="tr-detail">No visits yet. Start a tour and check in to an account.</p> : workspace.visits.map(visit => <div className="tr-history-row" key={visit.id}><div><strong>{visit.account}</strong><p>{LABEL[visit.type]} · {formatTime(visit.checkinAt)}</p>{visit.notes && <p className="tr-note">{visit.notes}</p>}</div><Tag type={visit.status === "CHECKED_IN" ? "blue" : "green"}>{visit.status === "CHECKED_IN" ? "On site" : "Done"}</Tag></div>)}
            </section>
          </div>}

          {view === "insights" && <>
            <div className="tr-metrics"><Metric label="Recorded tours" value={workspace.tours.length} context="All local sessions"/><Metric label="Completed visits" value={completedVisits.length} context="Checked out"/><Metric label="Doctor interactions" value={countByType("DOCTOR")} context="Local records"/><Metric label="Trade interactions" value={countByType("CHEMIST") + countByType("STOCKIST")} context="Chemist + stockist"/></div>
            <section className="tr-panel"><span className="tr-section-kicker">COVERAGE MIX</span><h3>Field interaction composition</h3><div className="tr-bars">{(["DOCTOR", "CHEMIST", "STOCKIST"] as VisitType[]).map(type => <div className="tr-bar-row" key={type}><span>{LABEL[type]}</span><div className="tr-bar"><span style={{width: workspace.visits.length ? (100 * countByType(type) / workspace.visits.length) + "%" : "0%"}}/></div><strong>{countByType(type)}</strong></div>)}</div><p className="tr-detail">Computed only from browser-local records. Not a server business report.</p></section>
          </>}

          {view === "integration" && <div className="tr-grid-wide">
            <section className="tr-panel"><span className="tr-section-kicker">SERVICE CONNECTIVITY</span><h2>API environment</h2><div className="tr-check-row"><span>Health endpoint</span><Tag type={health ? "green" : apiUnavailable ? "red" : "gray"}>{health ? "Responding" : apiUnavailable ? "Unavailable" : "Checking"}</Tag></div><div className="tr-check-row"><span>Identity variables</span><Tag type={health?.provider.identity === "configured" ? "green" : "gray"}>{health?.provider.identity ?? "Unknown"}</Tag></div><div className="tr-check-row"><span>Server mutation variables</span><Tag type={health?.provider.serverMutations === "configured" ? "green" : "gray"}>{health?.provider.serverMutations ?? "Unknown"}</Tag></div><p className="tr-detail">Configured variables do not establish authenticated connectivity or database health.</p></section>
            <section className="tr-panel"><span className="tr-section-kicker">SECURITY BOUNDARY</span><h3>Local workspace isolation</h3><p className="tr-detail">This interface never sends local tour or visit records to a remote service. Existing authenticated business endpoints are unchanged. Identity, RBAC and tenant selection remain pluggable for later activation.</p><Tag type="purple">Local device only</Tag></section>
          </div>}

          <footer className="tr-footer"><span>TERREVO / FIELD INTELLIGENCE</span><span>Operational workspace · data saved locally · not a qualified production release</span></footer>
        </main>
      </div>
    </div>
  );
}
