import {useEffect,useId,useMemo,useState} from "react";
import {Button,Tag,TextInput} from "@carbon/react";
import {authorizedCustomers,filterCustomers,safeText,visibleRelationships,visibleHistory,type Customer360ViewProps,type CustomerFilters,type CustomerKind,type CustomerActivity} from "./model";
export type {Customer360ViewProps,CustomerRelationship,CustomerActivity,WorkflowRequest} from "./model";
export {filterCustomers,authorizedCustomers,visibleRelationships,visibleHistory} from "./model";

export function Customer360View({
 tenantId,authorizedForTenantId,contextKey,masters,relationships=[],history=[],loading=false,error,onOpenWorkflow,
 onLinkRelationship,onUnlinkRelationship,loadHistory,
}:Customer360ViewProps){
 const idPrefix=useId();
 const [selection,setSelection]=useState<{tenantId:string;contextKey:string;id:string}|null>(null);
 const [filters,setFilters]=useState<CustomerFilters>({query:"",kind:"all",status:"",territory:""});
 const [linkTarget,setLinkTarget]=useState("");
 const [historyRows,setHistoryRows]=useState<CustomerActivity[]>(history);
 const [historyBusy,setHistoryBusy]=useState(false);
 const [relationshipBusy,setRelationshipBusy]=useState(false);
 const [message,setMessage]=useState("");

 useEffect(()=>{
   setSelection(null);setFilters({query:"",kind:"all",status:"",territory:""});
   setLinkTarget("");setHistoryRows([]);setMessage("");
 },[tenantId,contextKey]);

 const authorized=Boolean(tenantId&&contextKey&&tenantId===authorizedForTenantId);
 const customers=useMemo(()=>authorized?authorizedCustomers(masters):[],[authorized,masters]);
 const matching=useMemo(()=>filterCustomers(customers,filters),[customers,filters]);
 const selected=selection?.tenantId===tenantId&&selection.contextKey===contextKey?customers.find(x=>x.kind+":"+x.record.id===selection.id):undefined;
 const links=selected?visibleRelationships(tenantId,selected,customers,relationships):[];
 const entries=selected?visibleHistory(tenantId,selected,historyRows.length?historyRows:history):[];
 const territories=[...new Set(customers.map(x=>safeText(x.record.territoryName||x.record.territory||x.record.territoryId)).filter(Boolean))].sort();

 const targetKind:CustomerKind|null=selected?.kind==="doctor"?"chemist":selected?.kind==="chemist"?"stockist":null;
 const linkedIds=new Set(links.map(x=>x.targetId));
 const targetOptions=targetKind?customers.filter(x=>x.kind===targetKind&&x.record.status==="active"&&!linkedIds.has(x.record.id)):[];

 function change(part:Partial<CustomerFilters>){setFilters(old=>({...old,...part}));setSelection(null);setMessage("");}
 async function selectCustomer(kind:CustomerKind,id:string){
   setSelection({tenantId,contextKey,id:kind+":"+id});setLinkTarget("");setMessage("");
   if(loadHistory){
     setHistoryBusy(true);
     try{setHistoryRows(await loadHistory(kind,id));}
     catch(e){setHistoryRows([]);setMessage(e instanceof Error?e.message:"Unable to load customer history");}
     finally{setHistoryBusy(false);}
   }else setHistoryRows(history);
 }
 async function createLink(){
   if(!selected||!targetKind||!linkTarget||!onLinkRelationship)return;
   setRelationshipBusy(true);setMessage("");
   try{
     await onLinkRelationship(selected.kind,selected.record.id,targetKind,linkTarget);
     setLinkTarget("");setMessage("Outlet relationship saved.");
   }catch(e){setMessage(e instanceof Error?e.message:"Unable to save outlet relationship");}
   finally{setRelationshipBusy(false);}
 }
 async function removeLink(id:string){
   if(!onUnlinkRelationship)return;
   setRelationshipBusy(true);setMessage("");
   try{await onUnlinkRelationship(id);setMessage("Outlet relationship removed.");}
   catch(e){setMessage(e instanceof Error?e.message:"Unable to remove outlet relationship");}
   finally{setRelationshipBusy(false);}
 }

 return <div className="tr-grid-wide">
 <section className="tr-panel"><span className="tr-section-kicker">CUSTOMER 360</span><h2>Authorized customer directory</h2>
 {!authorized&&<p role="status">Select an authorized organization to view customers.</p>}
 {error&&<p role="alert">{error}</p>}{loading&&<p role="status">Loading authorized customers…</p>}
 <div className="tr-form">
 <TextInput id={idPrefix+"-c360-search"} labelText="Search name, code or territory" value={filters.query} onChange={e=>change({query:e.target.value})}/>
 <label htmlFor={idPrefix+"-c360-type"}>Customer type</label><select className="tr-select" id={idPrefix+"-c360-type"} value={filters.kind} onChange={e=>change({kind:e.target.value as CustomerKind|"all"})}>
 <option value="all">All types</option><option value="doctor">Doctor</option><option value="chemist">Chemist</option><option value="stockist">Stockist</option></select>
 <label htmlFor={idPrefix+"-c360-status"}>Status</label><select className="tr-select" id={idPrefix+"-c360-status"} value={filters.status} onChange={e=>change({status:e.target.value})}>
 <option value="">All statuses</option>{[...new Set(customers.map(x=>x.record.status))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
 <label htmlFor={idPrefix+"-c360-territory"}>Territory</label><select className="tr-select" id={idPrefix+"-c360-territory"} value={filters.territory} onChange={e=>change({territory:e.target.value})}>
 <option value="">All authorized territories</option>{territories.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
 {!loading&&authorized&&!matching.length&&<p role="status">No matching authorized customers.</p>}
 <div className="tr-list-sm">{matching.map(({kind,record})=><div className="tr-history-row" key={kind+":"+record.id}>
 <div><strong>{record.name}</strong><p>{kind} · {record.code||"No code"}</p></div>
 <Button kind="ghost" size="sm" onClick={()=>void selectCustomer(kind,record.id)} aria-label={"View "+kind+" "+record.name}>View profile</Button></div>)}</div>
 </section>

 <section className="tr-panel"><span className="tr-section-kicker">PROFILE, OUTLETS & HISTORY</span>
 {!selected?<p className="tr-detail">Select a customer to review verified information.</p>:<>
 <h2>{selected.record.name}</h2><Tag type="blue">{selected.kind}</Tag>
 <h3>Master fields</h3><dl>{(["code","status","specialty","qualification","territoryName","address","city"] as const).map(k=><div className="tr-history-row" key={k}><dt>{k}</dt><dd>{safeText(selected.record[k])||"Not provided"}</dd></div>)}</dl>

 <h3>Outlet linking</h3>
 <p className="tr-detail">Controlled chain: Doctor → Chemist → Stockist. RCPA and POB use these verified links as prerequisites.</p>
 {links.length?links.map(x=><div className="tr-history-row" key={x.id}>
   <div><strong>{x.target.record.name}</strong><p>{x.relationship.replace("_"," ↔ ")} · {x.targetKind.toLowerCase()}</p></div>
   {onUnlinkRelationship&&<Button kind="ghost" size="sm" disabled={relationshipBusy} onClick={()=>void removeLink(x.id)}>Unlink</Button>}
 </div>):<p>No authorized relationships supplied.</p>}
 {targetKind&&onLinkRelationship&&<div className="tr-form">
   <label htmlFor={idPrefix+"-c360-link"}>Link {targetKind}</label>
   <select className="tr-select" id={idPrefix+"-c360-link"} value={linkTarget} onChange={e=>setLinkTarget(e.target.value)}>
     <option value="">Select authorized {targetKind}</option>
     {targetOptions.map(x=><option key={x.record.id} value={x.record.id}>{x.record.name} · {x.record.code}</option>)}
   </select>
   <Button size="sm" disabled={relationshipBusy||!linkTarget} onClick={()=>void createLink()}>Link outlet</Button>
 </div>}
 {selected.kind==="stockist"&&<p className="tr-detail">Stockists receive chemist links from the Chemist profile to preserve the controlled Doctor → Chemist → Stockist direction.</p>}

 <h3>Verified activity history</h3>
 {historyBusy?<p role="status">Loading verified customer history…</p>:entries.length?entries.map(x=><div className="tr-history-row" key={x.id}><strong>{x.activityType}</strong><p>{new Date(x.occurredAt).toLocaleString()} · {x.summary}</p></div>):<p>No verified history supplied.</p>}
 {message&&<p role="status">{message}</p>}

 {onOpenWorkflow&&<div className="tr-form"><Button kind="secondary" onClick={()=>onOpenWorkflow({customerId:selected.record.id,customerType:selected.kind,workflow:"plan"})}>Open plan</Button>
 <Button kind="ghost" onClick={()=>onOpenWorkflow({customerId:selected.record.id,customerType:selected.kind,workflow:"field"})}>Open field workflow</Button></div>}
 </>}</section></div>;
}
