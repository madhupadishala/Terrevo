import {useEffect,useId,useMemo,useState} from "react";
import {Button,Tag,TextInput} from "@carbon/react";
import {allowedCatalog,canDetail,detailingIntent,isEligible,recordedSessions,type ClmLibraryProps} from "./model";
export type {ClmLibraryProps,CatalogScope,CatalogAsset,SessionSummary,ActiveVisit,DetailingHandoff} from "./model";
export {allowedCatalog,canDetail,detailingIntent,isEligible,recordedSessions} from "./model";
export function ClmLibraryView({scope,assets=[],sessions=[],activeVisit,loading=false,error,onRequestDetailing}:ClmLibraryProps){
 const [search,setSearch]=useState("");const [product,setProduct]=useState("");const [region,setRegion]=useState("");const [selected,setSelected]=useState("");const id=useId();
 const stamp=`${scope.tenantId}:${scope.authorizedForTenantId}:${scope.contextKey}:${scope.allowedRegions.join(",")}:${scope.allowedProductIds.join(",")}`;
 useEffect(()=>{setSearch("");setProduct("");setRegion("");setSelected("");},[stamp]);
 const catalog=useMemo(()=>allowedCatalog(scope,assets),[scope,assets]);
 const filtered=catalog.filter(a=>(!search||a.title.toLowerCase().includes(search.toLowerCase()))&&(!product||product===a.productId)&&(!region||region===a.regionCode));
 const eligible=filtered.filter(a=>isEligible(scope,a));const withdrawn=filtered.filter(a=>!isEligible(scope,a));
 const chosen=selected.startsWith(`${stamp}:`)?catalog.find(a=>`${stamp}:${a.id}:${a.version}`===selected):undefined;
 const history=recordedSessions(scope,assets,sessions);const authorized=Boolean(scope.tenantId&&scope.contextKey&&scope.tenantId===scope.authorizedForTenantId);
 function handoff(){if(!chosen||!activeVisit||!onRequestDetailing)return;const intent=detailingIntent(scope,chosen,activeVisit);if(intent)onRequestDetailing(intent);}
 return <div className="tr-grid-wide"><section className="tr-panel"><h2>Controlled CLM content library</h2><p className="tr-detail">Medical/legal-approved metadata. Content binaries are not loaded or cached here.</p>
 {!authorized&&<p role="status">Access denied: authorized organization context required.</p>}{loading&&<p role="status">Loading authorized catalog…</p>}{error&&<p role="alert">{error}</p>}
 {authorized&&<><div className="tr-form"><TextInput id={`${id}-search`} labelText="Search content title" value={search} onChange={e=>setSearch(e.target.value)}/>
 <label htmlFor={`${id}-product`}>Authorized product</label><select id={`${id}-product`} className="tr-select" value={product} onChange={e=>setProduct(e.target.value)}><option value="">All products</option>{scope.allowedProductIds.map(p=><option key={p} value={p}>{p}</option>)}</select>
 <label htmlFor={`${id}-region`}>Authorized region</label><select id={`${id}-region`} className="tr-select" value={region} onChange={e=>setRegion(e.target.value)}><option value="">All regions</option>{scope.allowedRegions.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
 <h3>Currently eligible content</h3>{!loading&&!eligible.length&&<p role="status">No currently approved content in this scope.</p>}
 {eligible.map(a=><div className="tr-history-row" key={`${a.id}:${a.version}`}><div><strong>{a.title}</strong><p>{a.productId} · {a.regionCode} · version {a.version}</p><small>Approved by {a.approvedBy} · expires {a.expiresAt}</small></div><Button kind="ghost" size="sm" onClick={()=>setSelected(`${stamp}:${a.id}:${a.version}`)}>Review eligibility</Button></div>)}
 <h3>Unavailable versions (metadata only)</h3>{!withdrawn.length&&<p>No withdrawn, expired or pending items in this scope.</p>}
 {withdrawn.map(a=><div className="tr-history-row" key={`${a.id}:${a.version}`}><div><strong>{a.title}</strong><p>{a.regionCode} · version {a.version}</p></div><Tag type="red">{a.status==="APPROVED"?"OUTSIDE EFFECTIVE WINDOW":a.status}</Tag></div>)}</>}
 </section><section className="tr-panel"><h2>Detailing handoff and session provenance</h2>
 {!chosen?<p role="status">Select eligible content to review its authorized detailing handoff.</p>:<><h3>{chosen.title} · {chosen.version}</h3><p>Region {chosen.regionCode}, product {chosen.productId}</p><p>Approval source: {chosen.provenanceId}</p><p>Valid {chosen.effectiveFrom} through {chosen.expiresAt}</p>
 <Tag type={canDetail(scope,chosen,activeVisit)?"green":"gray"}>{canDetail(scope,chosen,activeVisit)?"Eligible for approved active visit":"Handoff blocked"}</Tag>
 <p className="tr-detail">A handoff is a typed intent, not a presentation launch or persisted session. Chat 1 must verify asset ACL, revision and visit on the server.</p>
 <Button disabled={!canDetail(scope,chosen,activeVisit)||!onRequestDetailing} onClick={handoff}>Request detailing handoff</Button>{!onRequestDetailing&&<p>No verified detailing handoff adapter connected.</p>}
 <Button kind="ghost" onClick={()=>setSelected("")}>Close review</Button></>}
 <h3>Server-provided session history</h3>{!history.length&&<p role="status">No verified sessions for this catalog.</p>}
 {history.map(r=><div className="tr-history-row" key={r.id}><div><strong>{r.occurredAt}</strong><p>{r.status} · asset {r.assetId} ({r.assetVersion})</p><small>Session source {r.provenanceId}</small></div></div>)}
 </section></div>;
}
