import { useEffect, useMemo, useState } from "react";
import { Button, Tag, TextInput } from "@carbon/react";
import { getMonthGrid, localDate, shiftMonth, weekStart } from "./plan-calendar";
import type { Master, OrgUnit, Plan, PlanDay, PlanStop, TerrevoWebApi } from "./terrevo-api";

type Props = {
  api: TerrevoWebApi;
  connected: boolean;
  busy: boolean;
  plans: Plan[];
  units: OrgUnit[];
  masters: Record<string, Master[]>;
  focusCustomer?: { kind: "doctor" | "chemist" | "stockist"; id: string; territoryId: string; name: string } | null;
  perform: (fn: () => Promise<unknown>, label: string) => Promise<void>;
  onPlanNca?: (date: string, territoryId: string | null) => void;
};

export function MonthlyPlanner({ api, connected, busy, plans, units, masters, focusCustomer, perform, onPlanNca }: Props) {
  const [level, setLevel] = useState<"monthly"|"weekly"|"daily">("monthly");
  const [month, setMonth] = useState(localDate());
  const [selected, setSelected] = useState(localDate());
  const [details, setDetails] = useState<Record<string, Plan>>({});
  const [readFailures, setReadFailures] = useState<string[]>([]);
  const [territoryId, setTerritoryId] = useState("");
  const [stopType, setStopType] = useState<"doctor" | "chemist" | "stockist">("doctor");
  const [targetId, setTargetId] = useState("");
  const [stopRemark, setStopRemark] = useState("");
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [dayRemark, setDayRemark] = useState("");
  const grid = useMemo(() => getMonthGrid(month), [month]);

  useEffect(() => {
    if (!connected) { setDetails({});setReadFailures([]);return; }
    let alive = true;
    // The list endpoint returns only week summaries. Fetch the server's full days.
    void Promise.allSettled(plans.slice(0, 100).map(async plan => [plan.id, await api.getPlan(plan.id)] as const))
      .then(results => {
        if (!alive) return;
        const next: Record<string, Plan> = {};
        const failures: string[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value[1]) next[result.value[0]] = result.value[1];
          else failures.push(plans[index]?.id ?? "Unknown plan");
        });
        setDetails(next);
        setReadFailures(failures);
      });
    return () => { alive = false; };
  }, [connected, api, plans]);

  const selectedWeek = weekStart(selected);
  const weekDays = useMemo(() => Array.from({length:7},(_,i)=>{const d=new Date(Number(selectedWeek.slice(0,4)),Number(selectedWeek.slice(5,7))-1,Number(selectedWeek.slice(8)),12);d.setDate(d.getDate()+i);return localDate(d);}),[selectedWeek]);
  const monthWeeks = useMemo(()=>[...new Set(grid.filter(d=>d.inMonth).map(d=>weekStart(d.date)))],[grid]);
  const plan = plans.find(p => p.weekStart === selectedWeek);

  // The list can contain more than 100 weeks. Fetch a later selected week on
  // demand rather than leaving a permanently unfulfilled loading indicator.
  useEffect(() => {
    if (!connected || !plan || plans.findIndex(p => p.id === plan.id) < 100 ||
        details[plan.id] || readFailures.includes(plan.id)) return;
    let active = true;
    void api.getPlan(plan.id).then(result => {
      if (!active) return;
      if (result) setDetails(old => ({...old,[plan.id]:result}));
      else setReadFailures(old => [...new Set([...old,plan.id])]);
    }).catch(() => {
      if (active) setReadFailures(old => [...new Set([...old,plan.id])]);
    });
    return () => { active = false; };
  }, [connected, api, plan?.id, plans, details, readFailures]);

  const detail = plan ? details[plan.id] : undefined;
  const detailFailed = Boolean(plan && !detail && readFailures.includes(plan.id));
  const existingDay = detail?.days?.find(d => d.date === selected);
  const modifiable = !plan || plan.status === "DRAFT" || plan.status === "RETURNED";
  const targets = (masters[stopType==="doctor"?"doctors":stopType==="chemist"?"chemists":"stockists"]??[])
    .filter(m => m.status==="active" && (!territoryId || m.territoryId===territoryId));
  const territories = units.filter(u => u.status==="active" && u.type==="territory");
  const selectedStatus = plan?.status || "UNPLANNED";

  useEffect(() => {
    setStops(existingDay?.stops?.map((s,i) => ({ ...s, sequence: i+1 })) ?? []);
    setTerritoryId(existingDay?.territoryId ?? "");
    setDayRemark(existingDay?.remarks ?? "");
    setTargetId("");
    setStopRemark("");
  }, [selected, detail, existingDay?.date]);


  useEffect(() => {
    if (!connected || !focusCustomer) return;
    const list = masters[focusCustomer.kind==="doctor"?"doctors":focusCustomer.kind==="chemist"?"chemists":"stockists"]??[];
    const record = list.find(m=>m.id===focusCustomer.id&&m.status==="active"&&m.territoryId===focusCustomer.territoryId);
    if (!record || !territories.some(t=>t.id===focusCustomer.territoryId)) return;
    setStopType(focusCustomer.kind);
    setTerritoryId(focusCustomer.territoryId);
    setTargetId(focusCustomer.id);
    setLevel("daily");
  }, [connected, focusCustomer, masters, units]);

  function addStop() {
    if (!targetId || !territoryId) return;
    if (stops.some(s => s.type===stopType && s.targetId===targetId)) return;
    setStops(rows => [...rows, {
      sequence: rows.length+1, type: stopType, targetId,
      remarks: stopRemark.trim() || null,
    }]);
    setTargetId("");setStopRemark("");
  }
  function moveStop(index:number, direction:-1|1) {
    setStops(rows=>{const next=[...rows], destination=index+direction;
      if(destination<0||destination>=next.length)return rows;
      [next[index],next[destination]]=[next[destination],next[index]];
      return next.map((stop,i)=>({...stop,sequence:i+1}));
    });
  }
  async function saveDay() {
    if (!connected || busy || !modifiable || detailFailed || !territoryId || !stops.length) return;
    const entry: PlanDay = { date: selected, territoryId, remarks: dayRemark.trim()||null,
      stops: stops.map((s,i) => ({ ...s, sequence:i+1 })) };
    const combined = [...(detail?.days??[]).filter(d => d.date!==selected),entry]
      .sort((a,b)=>a.date.localeCompare(b.date));
    await perform(() => plan ? api.updatePlan(plan.id, selectedWeek, combined) :
      api.savePlan(selectedWeek, combined), "Weekly tour plan saved");
  }

  const totalMonthDays=Object.values(details).flatMap(p=>p.days?.map(d=>({...d,status:p.status}))??[]).filter(d=>d.date.slice(0,7)===month.slice(0,7));
  const weeklyDays=detail?.days??[];
  const monthlySummary = {plannedDays:totalMonthDays.length, plannedCalls:totalMonthDays.reduce((sum,d)=>sum+d.stops.length,0),approvedDays:totalMonthDays.filter(d=>d.status==="APPROVED").length};
  return <div className="tr-planning-root">
    <div className="tr-panel" role="group" aria-label="Tour planning levels">
      <div className="tr-section-line"><h2>Tour planning</h2><Tag type="blue">Server-backed weekly source of truth</Tag></div>
      <div className="tr-month-controls">{(["monthly","weekly","daily"] as const).map(mode=><Button key={mode} kind={level===mode?"primary":"secondary"} size="sm" onClick={()=>setLevel(mode)} aria-pressed={level===mode}>{mode==="monthly"?"Monthly Tour Plan":mode==="weekly"?"Weekly Tour Plan":"Daily Tour Plan"}</Button>)}</div>
      <p className="tr-detail">Monthly summaries and daily plans derive from the same authorized weekly records. Submitted and approved weeks remain read-only.</p>
    </div>
    <div className="tr-grid-wide tr-monthly-layout">
    {level==="monthly"&&<section className="tr-panel">
      <div className="tr-section-line">
        <span className="tr-section-kicker">MONTHLY FIELD PLANNING</span>
        <Tag type="blue">Existing weekly plan API</Tag>
      </div>
      <div className="tr-month-heading">
        <h2>{new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(new Date(Number(month.slice(0,4)), Number(month.slice(5,7))-1,1))}</h2>
        <div className="tr-month-controls">
          <Button kind="ghost" size="sm" aria-label="Previous month" onClick={()=>setMonth(m=>shiftMonth(m,-1))}>←</Button>
          <Button kind="ghost" size="sm" onClick={()=>{setMonth(localDate());setSelected(localDate());}}>Today</Button>
          <Button kind="ghost" size="sm" aria-label="Next month" onClick={()=>setMonth(m=>shiftMonth(m,1))}>→</Button>
        </div>
      </div>
      <div className="tr-month-grid" role="group" aria-label="Monthly tour plan calendar">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(name=><span key={name} className="tr-month-weekday">{name}</span>)}
        {grid.map(day => {
          const dailyPlans=Object.values(details)
            .filter(p => p.days?.some(d => d.date===day.date));
          const status=dailyPlans[0]?.status;
          return <button type="button" key={day.date} aria-label={day.date+" tour plan"} aria-pressed={selected===day.date}
            className={"tr-month-day"+(!day.inMonth?" tr-month-outside":"")+(selected===day.date?" tr-month-selected":"")}
            onClick={()=>setSelected(day.date)}>
            <span>{Number(day.date.slice(8))}</span>{day.isToday&&<small>Today</small>}
            {status&&<i aria-label={"Plan "+status} title={"Plan "+status}/>}
          </button>;
        })}
      </div>
      <div className="tr-month-summary" aria-label="Monthly coverage"><strong>{monthlySummary.plannedDays} planned days · {monthlySummary.plannedCalls} calls · {monthlySummary.approvedDays} approved days</strong></div>
      <p className="tr-detail">Monthly coverage aggregates authorized weekly plans, including weeks spanning month boundaries.</p>
      {readFailures.length>0&&<p className="tr-business-error" role="status">{readFailures.length} plan details could not be loaded. Editing affected weeks is disabled until data is available.</p>}
      <div className="tr-month-summary">
        <strong>Existing plans</strong>
        {plans.length?plans.slice(0,15).map(p=><div key={p.id} className="tr-history-row">
          <div><strong>Week of {p.weekStart}</strong><p>{p.id.slice(0,8)}</p></div>
          <Tag type={p.status==="APPROVED"?"green":p.status==="RETURNED"?"purple":"blue"}>{p.status}</Tag>
        </div>):<p className="tr-detail">No plans returned by the organization.</p>}
      </div>
    </section>}
    {level==="weekly"&&<section className="tr-panel">
      <span className="tr-section-kicker">WEEKLY TOUR PLAN</span>
      <h2>Week of {selectedWeek}</h2>
      <Tag type={selectedStatus==="APPROVED"?"green":"blue"}>{selectedStatus}</Tag>
      <div className="tr-month-controls"><Button kind="ghost" size="sm" onClick={()=>{const d=new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,Number(selected.slice(8)),12);d.setDate(d.getDate()-7);setSelected(localDate(d));}}>← Previous week</Button><Button kind="ghost" size="sm" onClick={()=>{const d=new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,Number(selected.slice(8)),12);d.setDate(d.getDate()+7);setSelected(localDate(d));}}>Next week →</Button></div>
      {weekDays.map(date=>{const day=weeklyDays.find(d=>d.date===date);return <div key={date} className="tr-history-row"><div><strong>{date}</strong><p>{day?`${day.stops.length} planned calls · ${units.find(u=>u.id===day.territoryId)?.name??day.territoryId}`:"No scheduled calls"}</p></div><Button kind="ghost" size="sm" onClick={()=>{setSelected(date);setLevel("daily");}}>View / plan day</Button></div>})}
      {plan&&!detail&&<p role="status">Weekly details loading or unavailable. Submission is disabled.</p>}
      <Button disabled={!connected||busy||!plan||!detail||!modifiable||weeklyDays.length===0} onClick={()=>plan&&void perform(()=>api.submitPlan(plan.id),"Weekly tour plan submitted for manager approval")}>Submit weekly plan for approval</Button>
      <p className="tr-detail">All dates and call sequences are saved in the existing weekly plan. Manager approval applies to the submitted week.</p>
    </section>}
    {level==="monthly"&&<section className="tr-panel"><span className="tr-section-kicker">MONTH WEEKS</span><h2>Weekly breakdown</h2>{monthWeeks.map(week=>{const p=plans.find(x=>x.weekStart===week);const d=p?details[p.id]?.days??[]:[];return <div key={week} className="tr-history-row"><div><strong>Week of {week}</strong><p>{d.length} planned days · {d.reduce((n,x)=>n+x.stops.length,0)} calls · {p?.status??"UNPLANNED"}</p></div><Button kind="ghost" size="sm" onClick={()=>{setSelected(week);setLevel("weekly");}}>Open week</Button></div>})}</section>}
    {level==="daily"&&<section className="tr-panel">
      <span className="tr-section-kicker">DAILY TOUR PLAN</span>
      <h2>{new Intl.DateTimeFormat(undefined,{weekday:"long",day:"numeric",month:"short"}).format(new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,Number(selected.slice(8))))}</h2>
      <div className="tr-month-controls"><Button kind="ghost" size="sm" onClick={()=>{const d=new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,Number(selected.slice(8)),12);d.setDate(d.getDate()-1);setSelected(localDate(d));}}>← Previous day</Button><input type="date" aria-label="Selected daily tour date" value={selected} onChange={e=>{if(e.target.value){setSelected(e.target.value);setMonth(e.target.value);}}}/><Button kind="ghost" size="sm" onClick={()=>{const d=new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,Number(selected.slice(8)),12);d.setDate(d.getDate()+1);setSelected(localDate(d));}}>Next day →</Button></div>
      <Tag type={selectedStatus==="APPROVED"?"green":"gray"}>{selectedStatus}</Tag>
      {plan&&!modifiable&&<p className="tr-detail">This week is submitted or approved. Read-only: return the plan through the manager workflow before editing.</p>}
      {plan&&!detail&&<p className="tr-detail">Loading authorized weekly plan details…</p>}
      <div className="tr-form">
        <label className="tr-select-label" htmlFor="calendar-territory">Territory</label>
        <select id="calendar-territory" className="tr-select" value={territoryId} disabled={!connected||!modifiable||Boolean(plan&&!detail)}
          onChange={e=>{setTerritoryId(e.target.value);setTargetId("");}}>
          <option value="">Select assigned territory</option>
          {territories.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="tr-select-label" htmlFor="calendar-visit-type">Call type</label>
        <select id="calendar-visit-type" className="tr-select" value={stopType} disabled={!connected||!modifiable}
          onChange={e=>{setStopType(e.target.value as typeof stopType);setTargetId("");}}>
          <option value="doctor">Doctor</option><option value="chemist">Chemist</option><option value="stockist">Stockist</option>
        </select>
        <label className="tr-select-label" htmlFor="calendar-account">Planned account</label>
        <select id="calendar-account" className="tr-select" value={targetId} disabled={!connected||!modifiable||!territoryId} onChange={e=>setTargetId(e.target.value)}>
          <option value="">Select existing account</option>
          {targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <TextInput id="calendar-remark" labelText="Stop remarks" value={stopRemark} maxLength={1000}
          disabled={!modifiable} onChange={e=>setStopRemark(e.target.value)}/>
        <Button kind="secondary" disabled={!connected||busy||!modifiable||!territoryId||!targetId||Boolean(plan&&!detail)}
          onClick={addStop}>Add planned call</Button>
      </div>
      {focusCustomer&&<p className="tr-detail" role="status">Selected from Customer 360: <strong>{focusCustomer.name}</strong> ({focusCustomer.kind}). Confirm the date and add the call before saving.</p>}
      <h3>Planned calls ({stops.length})</h3>
      {stops.map((s,i)=><div key={s.type+":"+s.targetId} className="tr-history-row">
        <div><strong>{i+1}. {masters[s.type==="doctor"?"doctors":s.type==="chemist"?"chemists":"stockists"]?.find(t=>t.id===s.targetId)?.name??s.targetId}</strong>
          <p>{s.type} · {s.remarks??"No remarks"}</p></div>
        {modifiable&&<div className="tr-month-controls"><Button kind="ghost" size="sm" disabled={i===0} aria-label={`Move visit ${i+1} earlier`} onClick={()=>moveStop(i,-1)}>↑</Button><Button kind="ghost" size="sm" disabled={i===stops.length-1} aria-label={`Move visit ${i+1} later`} onClick={()=>moveStop(i,1)}>↓</Button><Button kind="ghost" size="sm" onClick={()=>setStops(rows=>rows.filter((_,j)=>i!==j))}>Remove</Button></div>}
      </div>)}
      <div className="tr-form">
        <TextInput id="calendar-day-remark" labelText="Day remarks (optional)" maxLength={1000}
          disabled={!modifiable} value={dayRemark} onChange={e=>setDayRemark(e.target.value)}/>
        <Button disabled={!connected||busy||!modifiable||!territoryId||!stops.length||Boolean(plan&&!detail)}
          onClick={()=>void saveDay()}>Save {plan?"updated":"new"} weekly plan</Button>
      </div>
      <div className="tr-month-controls"><Button kind="secondary" size="sm" disabled={!connected||!onPlanNca} onClick={()=>onPlanNca?.(selected,territoryId||existingDay?.territoryId||null)}>Plan NCA for this day</Button><Button kind="ghost" size="sm" onClick={()=>setLevel("weekly")}>Return to weekly plan</Button></div>
      <p className="tr-detail">NCA uses the controlled NCA workflow and remains a distinct activity record; it is never saved as a customer visit.</p>
    </section>}
  </div></div>;
}
