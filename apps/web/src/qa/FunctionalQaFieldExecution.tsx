import {useState} from "react";
import {Button,Tag,TextArea} from "@carbon/react";
import {useDcr,useTerrevoData,useVisit} from "./TerrevoDataProvider";
export function FunctionalQaFieldExecution(){
 const data=useTerrevoData();const visit=useVisit();const dcr=useDcr();const [outcome,setOutcome]=useState("Detailed");const [message,setMessage]=useState("");
 const act=(fn:()=>void,ok:string)=>{setMessage("");try{fn();setMessage(ok)}catch(e){setMessage(e instanceof Error?e.message:"Operation failed")}};
 const name=(v:typeof data.state.visits[number])=>v.customerType==="DOCTOR"?data.state.doctors.find(x=>x.id===v.customerId)?.name:v.customerType==="CHEMIST"?data.state.chemists.find(x=>x.id===v.customerId)?.name:data.state.stockists.find(x=>x.id===v.customerId)?.name;
 return <div className="tr-grid-wide" data-testid="qa-field-execution">
  <section className="tr-panel"><span className="tr-section-kicker">FUNCTIONAL QA / FIELD EXECUTION</span><h2>{visit.activeVisit?"Active customer visit":"Daily agenda"}</h2>
   {data.state.visits.map(v=><div className="tr-history-row" key={v.id} data-testid={"visit-row-"+v.id}><div><strong>{name(v)}</strong><p>{v.customerType} · {v.plannedAt}</p></div><Tag type={v.status==="COMPLETED"?"green":v.status==="CHECKED_IN"?"blue":"gray"}>{v.status}</Tag>
    {v.status==="PLANNED"&&!visit.activeVisit&&<Button size="sm" data-testid={"visit-checkin-"+v.id} onClick={()=>act(()=>visit.checkIn(v.id),"Checked in")}>Check in</Button>}
   </div>)}
  </section>
  <section className="tr-panel"><span className="tr-section-kicker">VISIT LIFECYCLE</span><h2>Call completion</h2>
   {visit.activeVisit?<><p><strong>{name(visit.activeVisit)}</strong> · {visit.activeVisit.customerType}</p>
    <TextArea id="qa-call-outcome" data-testid="visit-outcome" labelText="Call outcome / remarks" value={outcome} onChange={e=>setOutcome(e.target.value)}/>
    <Button data-testid="visit-complete" disabled={!outcome.trim()} onClick={()=>act(()=>visit.close(visit.activeVisit!.id,outcome),"Visit completed")}>Check out & complete visit</Button>
   </>:<p className="tr-detail">No active check-in. Select the next planned visit from the agenda.</p>}
   <div className="tr-check-row"><span>DCR preview completed visits</span><strong>{dcr.preview.visitIds.length}</strong></div>
   {message&&<p role="status">{message}</p>}
  </section>
 </div>;
}
