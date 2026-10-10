import {useEffect,useMemo,useState} from "react";
import {Button,Tag,TextArea,TextInput} from "@carbon/react";
import {emptyActivityDraft,validateActivityDraft,type ActivitiesViewProps,type ActivityDraft,type ActivityKind,type ActivityCustomerKind} from "./model";
export type {ActivitiesViewProps,ActivityDraft,ActivityEvidence,NcaSubtype,PlannedCallOption} from "./model";
export {validateActivityDraft,emptyActivityDraft} from "./model";
export function ActivitiesView({tenantId,authorizedForTenantId,contextKey,territories,customers={},plannedCalls=[],ncaSubtypes=[],onSaveDraft,loading=false}:ActivitiesViewProps){
 const scope=tenantId+":"+contextKey;
 const [state,setState]=useState<{scope:string;draft:ActivityDraft}>({scope,draft:emptyActivityDraft(tenantId,"")});
 const [review,setReview]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{setState({scope,draft:emptyActivityDraft(tenantId,"")});setReview(false);setMessage("");},[scope,tenantId]);
 const authorized=Boolean(tenantId&&contextKey&&authorizedForTenantId===tenantId);
 const draft=state.scope===scope?state.draft:emptyActivityDraft(tenantId,"");
 const context=useMemo(()=>({territories,customers,plannedCalls,ncaSubtypes}),[territories,customers,plannedCalls,ncaSubtypes]);
 const errors=validateActivityDraft(draft,context);
 function patch(changes:Partial<ActivityDraft>){setState({scope,draft:{...draft,...changes}});setReview(false);setMessage("");}
 function setKind(kind:ActivityKind){patch({kind,plannedStopId:undefined,customerType:undefined,customerId:undefined,ncaSubtype:undefined});}
 function setCustomerKind(kind:ActivityCustomerKind){patch({customerType:kind,customerId:undefined});}
 const group=draft.customerType==="doctor"?"doctors":draft.customerType==="chemist"?"chemists":"stockists";
 const planned=plannedCalls.filter(p=>p.workDate===draft.workDate&&p.territoryId===draft.territoryId);
 async function save(){
  if(!authorized||errors.length||!review||!onSaveDraft||busy)return;
  setBusy(true);setMessage("");
  try{await onSaveDraft({...draft});setMessage("Draft handed to the integration callback. Server persistence is not verified.");setReview(false);}
  catch(e){setMessage(e instanceof Error?e.message:"Draft handoff failed.");}
  finally{setBusy(false);}
 }
 return <section className="tr-panel"><span className="tr-section-kicker">FIELD ACTIVITIES</span><h2>Planned, unplanned and non-call activity</h2>
 <Tag type="purple">Draft only — no verified NCA submission API</Tag>
 {!authorized&&<p role="status">Choose an authorized organization before drafting activities.</p>}
 {loading&&<p role="status">Loading available activity options…</p>}
 <div className="tr-form">
 <label htmlFor="activity-kind">Activity classification</label><select id="activity-kind" className="tr-select" value={draft.kind} disabled={!authorized||busy}
 onChange={e=>setKind(e.target.value as ActivityKind)}><option value="PLANNED_CALL">Planned call</option><option value="UNPLANNED_CALL">Unplanned call</option><option value="NON_CALL_ACTIVITY">Non-call activity (NCA)</option></select>
 <TextInput id="activity-date" type="date" labelText="Activity date" value={draft.workDate} disabled={!authorized||busy} onChange={e=>patch({workDate:e.target.value,plannedStopId:undefined})}/>
 <label htmlFor="activity-territory">Authorized territory</label><select id="activity-territory" className="tr-select" value={draft.territoryId} disabled={!authorized||busy} onChange={e=>patch({territoryId:e.target.value,plannedStopId:undefined})}>
 <option value="">Choose territory</option>{territories.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
 {draft.kind==="PLANNED_CALL"&&<><label htmlFor="activity-stop">Verified planned call</label><select id="activity-stop" className="tr-select" value={draft.plannedStopId||""} onChange={e=>patch({plannedStopId:e.target.value})}>
 <option value="">Choose planned stop</option>{planned.map(x=><option value={x.planStopId} key={x.planStopId}>{x.label}</option>)}</select></>}
 {draft.kind==="UNPLANNED_CALL"&&<>
 <label htmlFor="activity-customer-type">Customer type</label><select id="activity-customer-type" className="tr-select" value={draft.customerType||""} onChange={e=>setCustomerKind(e.target.value as ActivityCustomerKind)}>
 <option value="">Choose type</option><option value="doctor">Doctor</option><option value="chemist">Chemist</option><option value="stockist">Stockist</option></select>
 <label htmlFor="activity-customer">Authorized customer</label><select id="activity-customer" className="tr-select" value={draft.customerId||""} disabled={!draft.customerType} onChange={e=>patch({customerId:e.target.value})}>
 <option value="">Choose customer</option>{(draft.customerType?customers[group]??[]:[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
 {draft.kind==="NON_CALL_ACTIVITY"&&<><label htmlFor="activity-subtype">Approved NCA category</label><select id="activity-subtype" className="tr-select" value={draft.ncaSubtype||""} onChange={e=>patch({ncaSubtype:e.target.value})}>
 <option value="">Choose NCA category</option>{ncaSubtypes.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}</select></>}
 <TextInput id="activity-reason" labelText="Reason" value={draft.reason} maxLength={500} disabled={!authorized||busy} onChange={e=>patch({reason:e.target.value})}/>
 <TextInput id="activity-duration" type="number" min={1} max={1440} labelText="Duration (minutes)" value={String(draft.durationMinutes||"")} disabled={!authorized||busy}
 onChange={e=>patch({durationMinutes:Number(e.target.value)})}/>
 <TextArea id="activity-remarks" labelText="Remarks" value={draft.remarks} maxLength={2000} disabled={!authorized||busy} onChange={e=>patch({remarks:e.target.value})}/>
 <h3>Optional evidence metadata (no upload)</h3>
 <TextInput id="activity-evidence" labelText="Evidence filename or reference" value={draft.evidence?.name||""} onChange={e=>patch({evidence:e.target.value?{name:e.target.value,mimeType:"unknown",sizeBytes:0}:undefined})}/>
 </div>
 {errors.length>0&&<div role="status"><strong>Complete before review:</strong><ul>{errors.map(e=><li key={e}>{e}</li>)}</ul></div>}
 {!review?<Button disabled={!authorized||loading||errors.length>0||busy} onClick={()=>setReview(true)}>Review activity draft</Button>:<div className="tr-panel" aria-label="Review activity">
 <h3>Review before draft handoff</h3><p>{draft.kind} · {draft.workDate} · {draft.territoryId} · {draft.durationMinutes} minutes</p>
 <p>Reason: {draft.reason}</p><p>Evidence: {draft.evidence?.name||"None"}</p><p>No record has been saved on a server.</p>
 <Button kind="secondary" onClick={()=>setReview(false)}>Edit</Button>
 <Button disabled={!onSaveDraft||busy||errors.length>0} onClick={()=>void save()}>Hand off draft</Button>
 {!onSaveDraft&&<p role="status">Draft callback unavailable; review only. Nothing will be submitted.</p>}</div>}
 {message&&<p role="status">{message}</p>}</section>;
}
