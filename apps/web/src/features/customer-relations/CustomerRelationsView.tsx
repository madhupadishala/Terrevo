import {useEffect,useId,useMemo,useState} from "react";
import {Button,TextInput} from "@carbon/react";
import {approvedLinks,isAuthorized,safeHistory,visibleSubject,type RelationshipViewProps} from "./model";
export type {RelationshipViewProps,ViewerScope,CustomerRef,RelationshipEvidence,VisitSummary} from "./model";
export {approvedLinks,safeHistory,visibleSubject} from "./model";
export function CustomerRelationsView({scope,subject,authorizedCustomers,relationships=[],history=[],loading=false,error,onOpenSource}:RelationshipViewProps){
 const [query,setQuery]=useState("");const [from,setFrom]=useState("");const [to,setTo]=useState("");const [selectedKey,setSelectedKey]=useState("");
 const id=useId();const stamp=`${scope.tenantId}:${scope.authorizedForTenantId}:${scope.contextKey}:${scope.role}:${subject?.kind||""}:${subject?.id||""}`;
 useEffect(()=>{setQuery("");setFrom("");setTo("");setSelectedKey("");},[stamp]);
 const authorized=isAuthorized(scope);const selected=visibleSubject(scope,subject,authorizedCustomers);
 const links=useMemo(()=>approvedLinks(scope,subject,authorizedCustomers,relationships),[scope,subject,authorizedCustomers,relationships]);
 const filtered=links.filter(l=>[l.targetCustomer.name,l.relation,l.targetCustomer.kind].some(s=>s.toLowerCase().includes(query.trim().toLowerCase())));
 const visits=useMemo(()=>safeHistory(scope,subject,authorizedCustomers,history,from,to),[scope,subject,authorizedCustomers,history,from,to]);
 const inspected=selectedKey.startsWith(`${stamp}:`)?links.find(l=>`${stamp}:${l.id}`===selectedKey):undefined;
 function openSource(sourceId:string,sourceType:"RELATIONSHIP"|"VISIT"){if(authorized&&selected&&scope.mayOpenSource&&onOpenSource&&sourceId)onOpenSource({tenantId:scope.tenantId,contextKey:scope.contextKey,sourceId,sourceType});}
 return <div className="tr-grid-wide"><section className="tr-panel"><h2>Approved customer relationships</h2>
 {!authorized||!selected?<p role="status">No authorized customer selected for this organization and territory.</p>:<><p className="tr-detail">{selected.kind} · {selected.name} · Authorized links only</p>
 <TextInput id={`${id}-link-search`} labelText="Filter approved links" value={query} onChange={e=>setQuery(e.target.value)}/>
 {loading&&<p role="status">Loading verified relationships…</p>}{error&&<p role="alert">{error}</p>}
 {!loading&&!filtered.length&&<p role="status">No verified approved relationships returned.</p>}
 <div className="tr-list-sm">{filtered.map(l=><div className="tr-history-row" key={l.id}><div><strong>{l.targetCustomer.name}</strong><p>{l.targetCustomer.kind} · {l.relation}</p><small>Evidence {l.evidenceType} · verified {l.verifiedAt}</small></div><Button kind="ghost" size="sm" onClick={()=>setSelectedKey(`${stamp}:${l.id}`)}>Details</Button></div>)}</div>
 {inspected&&<div role="region" aria-label="Approved relationship detail"><h3>{inspected.relation}</h3><p>Linked account: {inspected.targetCustomer.name}</p><p>Approval: {inspected.approval} · Evidence reference: {inspected.evidenceId}</p><Button kind="secondary" size="sm" onClick={()=>setSelectedKey("")}>Close details</Button> <Button size="sm" disabled={!scope.mayOpenSource||!onOpenSource} onClick={()=>openSource(inspected.evidenceId,"RELATIONSHIP")}>Open authorized source</Button></div>}</>}
 </section><section className="tr-panel"><h2>Patient-safe visit chronology</h2>
 {!authorized||!selected?<p role="status">History is unavailable without an authorized customer.</p>:!scope.mayViewHistory?<p role="status">This role is not permitted to view visit history.</p>:<><p className="tr-detail">Only source-provided, patient-safe summaries. Not a patient record.</p>
 <div className="tr-form"><label htmlFor={`${id}-from`}>From date</label><input id={`${id}-from`} type="date" value={from} onChange={e=>setFrom(e.target.value)}/><label htmlFor={`${id}-to`}>To date</label><input id={`${id}-to`} type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></div>
 {!loading&&!visits.length&&<p role="status">No authorized visit summaries for these dates.</p>}
 <div className="tr-list-sm">{visits.map(v=><div key={v.id} className="tr-history-row"><div><strong>{v.visitType} · {new Date(v.occurredAt).toLocaleString()}</strong><p>{v.summary}</p><small>Source: {v.provenanceId}</small></div><Button size="sm" kind="ghost" disabled={!scope.mayOpenSource||!onOpenSource} onClick={()=>openSource(v.provenanceId,"VISIT")}>View source</Button></div>)}</div></>}
 </section></div>;
}
