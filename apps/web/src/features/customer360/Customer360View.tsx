import {useEffect,useId,useMemo,useState} from "react";
import {Button,Tag,TextInput} from "@carbon/react";
import {authorizedCustomers,filterCustomers,safeText,visibleRelationships,visibleHistory,type Customer360ViewProps,type CustomerFilters,type CustomerKind} from "./model";
export type {Customer360ViewProps,CustomerRelationship,CustomerActivity,WorkflowRequest} from "./model";
export {filterCustomers,authorizedCustomers,visibleRelationships,visibleHistory} from "./model";
export function Customer360View({tenantId,authorizedForTenantId,contextKey,masters,relationships=[],history=[],loading=false,error,onOpenWorkflow}:Customer360ViewProps){
 const scope=tenantId+":"+contextKey;
 const idPrefix=useId();
 const [selection,setSelection]=useState<{scope:string;id:string}|null>(null);
 const [filters,setFilters]=useState<CustomerFilters>({query:"",kind:"all",status:"",territory:""});
 useEffect(()=>{setSelection(null);setFilters({query:"",kind:"all",status:"",territory:""});},[scope]);
 const authorized=Boolean(tenantId&&contextKey&&tenantId===authorizedForTenantId);
 const customers=useMemo(()=>authorized?authorizedCustomers(masters):[],[authorized,masters]);
 const matching=useMemo(()=>filterCustomers(customers,filters),[customers,filters]);
 const selected=selection?.scope===scope?customers.find(x=>x.kind+":"+x.record.id===selection.id):undefined;
 const links=selected?visibleRelationships(tenantId,selected,customers,relationships):[];
 const entries=selected?visibleHistory(tenantId,selected,history):[];
 const territories=[...new Set(customers.map(x=>safeText(x.record.territoryName||x.record.territory||x.record.territoryId)).filter(Boolean))].sort();
 function change(part:Partial<CustomerFilters>){setFilters(old=>({...old,...part}));setSelection(null);}
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
 <Button kind="ghost" size="sm" onClick={()=>setSelection({scope,id:kind+":"+record.id})} aria-label={"View "+kind+" "+record.name}>View profile</Button></div>)}</div>
 </section>
 <section className="tr-panel"><span className="tr-section-kicker">PROFILE & HISTORY</span>
 {!selected?<p className="tr-detail">Select a customer to review verified information.</p>:<>
 <h2>{selected.record.name}</h2><Tag type="blue">{selected.kind}</Tag>
 <h3>Master fields</h3><dl>{(["code","status","specialty","qualification","territoryName","address","city"] as const).map(k=><div className="tr-history-row" key={k}><dt>{k}</dt><dd>{safeText(selected.record[k])||"Not provided"}</dd></div>)}</dl>
 <h3>Authorized relationships</h3>{links.length?links.map(x=><div className="tr-history-row" key={x.id}><strong>{x.target.record.name}</strong><p>{x.relationship} · {x.targetKind}</p></div>):<p>No authorized relationships supplied.</p>}
 <h3>Verified activity history</h3>{entries.length?entries.map(x=><div className="tr-history-row" key={x.id}><strong>{x.activityType}</strong><p>{x.occurredAt} · {x.summary}</p></div>):<p>No verified history supplied.</p>}
 {onOpenWorkflow&&<div className="tr-form"><Button kind="secondary" onClick={()=>onOpenWorkflow({customerId:selected.record.id,customerType:selected.kind,workflow:"plan"})}>Open plan</Button>
 <Button kind="ghost" onClick={()=>onOpenWorkflow({customerId:selected.record.id,customerType:selected.kind,workflow:"field"})}>Open field workflow</Button></div>}
 </>}</section></div>;
}
