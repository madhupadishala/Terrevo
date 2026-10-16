import {useState} from "react";
import {Button,Tag,TextArea} from "@carbon/react";
import {useDcr,useTerrevoData,useVisit} from "./TerrevoDataProvider";
export function FunctionalQaFieldExecution(){
 const data=useTerrevoData();const visit=useVisit();const dcr=useDcr();const [outcome,setOutcome]=useState("Detailed");const [message,setMessage]=useState("");
 const act=async(fn:()=>void|Promise<void>,ok:string)=>{setMessage("");try{await fn();setMessage(ok)}catch(e){setMessage(e instanceof Error?e.message:"Operation failed")}};
 const name=(v:typeof data.state.visits[number])=>v.customerType==="DOCTOR"?data.state.doctors.find(x=>x.id===v.customerId)?.name:v.customerType==="CHEMIST"?data.state.chemists.find(x=>x.id===v.customerId)?.name:data.state.stockists.find(x=>x.id===v.customerId)?.name;
 return <div className="tr-grid-wide" data-testid="qa-field-execution">
  <section className="tr-panel"><span className="tr-section-kicker">{data.mode==="LIVE_API"?"LIVE / FIELD EXECUTION":"FUNCTIONAL QA / FIELD EXECUTION"}</span><h2>{visit.activeVisit?"Active customer visit":"Daily agenda"}</h2>
   {!data.state.visits.length&&visit.startOptions.length>0&&<div className="tr-list-sm">{visit.startOptions.map(o=><div className="tr-history-row" key={o.planDayId}><div><strong>Approved DTP</strong><p>{o.workDate} · {o.territoryId}</p></div><Button data-testid={"start-workday-"+o.planDayId} size="sm" onClick={()=>void act(()=>visit.workday.start(o.planDayId),"Workday started")}>Start My Day</Button></div>)}</div>}
   {!data.state.visits.length&&visit.startOptions.length===0&&<p className="tr-detail">No approved workday is available to start.</p>}
   {data.state.visits.map(v=><div className="tr-history-row" key={v.id} data-testid={"visit-row-"+v.id}><div><strong>{name(v)}</strong><p>{v.customerType} · {v.plannedAt}</p></div><Tag type={v.status==="COMPLETED"?"green":v.status==="CHECKED_IN"?"blue":"gray"}>{v.status}</Tag>
    {v.status==="PLANNED"&&!visit.activeVisit&&<Button size="sm" data-testid={"visit-checkin-"+v.id} onClick={()=>void act(()=>visit.checkIn(v.id),"Checked in")}>Check in</Button>}
   </div>)}
  </section>
  <section className="tr-panel"><span className="tr-section-kicker">VISIT LIFECYCLE</span><h2>Call completion</h2>
   {visit.activeVisit?<><p><strong>{name(visit.activeVisit)}</strong> · {visit.activeVisit.customerType}</p>
    <TextArea id="qa-call-outcome" data-testid="visit-outcome" labelText="Call outcome / remarks" value={outcome} onChange={e=>setOutcome(e.target.value)}/>
    <Button data-testid="visit-complete" disabled={!outcome.trim()} onClick={()=>void act(()=>visit.close(visit.activeVisit!.id,outcome),"Visit completed")}>Check out & complete visit</Button>
   </>:<p className="tr-detail">No active check-in. Select the next planned visit from the agenda.</p>}
   <div className="tr-check-row"><span>DCR preview completed visits</span><strong>{dcr.preview.visitIds.length}</strong></div>
   {data.mode==="LIVE_API"&&data.state.visits.length>0&&!visit.activeVisit&&data.state.visits.every(v=>v.status==="COMPLETED")&&<Button kind="tertiary" data-testid="end-workday" onClick={()=>void act(()=>visit.workday.submit(null),"Workday submitted")}>End My Day</Button>}
   {message&&<p role="status">{message}</p>}
  </section>
 </div>;
}
