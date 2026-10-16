import {useState} from "react";
import {Button,Tag,TextArea} from "@carbon/react";
import {useManagerCommand,useTerrevoData} from "./TerrevoDataProvider";
export function FunctionalQaManagerCommand(){
 const data=useTerrevoData();const manager=useManagerCommand();const [comment,setComment]=useState("");const [message,setMessage]=useState("");
 const m=manager.metrics;const act=(fn:()=>void,ok:string)=>{setMessage("");try{fn();setMessage(ok)}catch(e){setMessage(e instanceof Error?e.message:"Operation failed")}};
 return <div className="tr-grid-wide" data-testid="qa-manager-command">
  <section className="tr-panel"><span className="tr-section-kicker">MANAGER COMMAND</span><h2>{data.state.manager.name} · 5-rep team</h2>
   <div className="tr-tour-stats">
    <div><span>TEAM</span><strong>{m.teamMembers}</strong></div><div><span>ACTIVE TOURS</span><strong>{m.activeTours}</strong></div><div><span>SUBMITTED DAYS</span><strong>{m.submittedDays}</strong></div>
    <div><span>PLANNED CALLS</span><strong>{m.plannedCalls}</strong></div><div><span>COMPLETED</span><strong>{m.completedCalls}</strong></div>
   </div>
   <div className="tr-check-row"><span>Pending DCRs</span><strong>{m.pendingDcrs}</strong></div><div className="tr-check-row"><span>Tour plans</span><strong>{m.pendingTourPlans}</strong></div>
   <div className="tr-check-row"><span>GPS exceptions</span><strong>{m.pendingGpsExceptions}</strong></div>
   <div className="tr-check-row"><span>NCAs</span><strong>{m.pendingNca}</strong></div>
   <div className="tr-check-row"><span>Expenses</span><strong>{m.pendingExpenses}</strong></div>
   <div className="tr-check-row"><span>Leaves</span><strong>{m.pendingLeaves}</strong></div>
  </section>
  <section className="tr-panel"><span className="tr-section-kicker">APPROVAL QUEUES</span><h2>Pending decisions</h2>
   {manager.queue.length?manager.queue.map(q=><div className="tr-history-row" key={q.kind+q.id} data-testid={"manager-queue-"+q.kind.toLowerCase()+"-"+q.id}><div><strong>{q.kind}</strong><p>{q.label} · {q.repId}</p></div><Tag type="blue">{q.status}</Tag><div className="tr-button-row"><Button size="sm" onClick={()=>act(()=>manager.decide(q,true),"Approved")}>Approve</Button><Button kind="secondary" size="sm" disabled={!comment.trim()} onClick={()=>act(()=>manager.decide(q,false,comment),"Returned / rejected")}>Return / reject</Button></div></div>):<p className="tr-detail">No pending approvals.</p>}
   <TextArea id="approval-comment" data-testid="manager-command-comment" labelText="Return / rejection comment" value={comment} onChange={e=>setComment(e.target.value)}/>
   {message&&<p role="status">{message}</p>}
  </section>
 </div>;
}
