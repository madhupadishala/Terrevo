import {useEffect,useId,useMemo,useState} from "react";
import {Button,Tag,TextInput} from "@carbon/react";
import {allowedOwner,reviewClaims,type EvidenceViewProps} from "./model";
export type {EvidenceViewProps,EvidenceScope,Claim,ReceiptManifest,TravelEvidence,AttendanceEvidence,PolicyLimit,ClaimReview} from "./model";
export {reviewClaims,verifiedMinorTotal,allowedOwner} from "./model";
const money=(v:number|null,currency:string)=>v===null?"Invalid amount":`${currency} ${ (v/100).toFixed(2) }`;
export function WorkforceEvidenceView({scope,claims=[],receipts=[],travel=[],attendance=[],policies=[],loading=false,error,onRequestReceiptReview}:EvidenceViewProps){
 const [query,setQuery]=useState("");const [selected,setSelected]=useState("");const id=useId();
 const stamp=`${scope.tenantId}:${scope.authorizedForTenantId}:${scope.contextKey}:${scope.viewerUserId}:${scope.role}:${scope.permittedUserIds.join(",")}`;
 useEffect(()=>{setQuery("");setSelected("");},[stamp]);
 const authorized=Boolean(scope.tenantId&&scope.tenantId===scope.authorizedForTenantId&&scope.contextKey&&scope.viewerUserId);
 const reviews=useMemo(()=>reviewClaims(scope,claims,receipts,travel,attendance,policies),[scope,claims,receipts,travel,attendance,policies]);
 const filtered=reviews.filter(r=>[r.claim.id,r.claim.workDate,r.claim.ownerUserId].some(v=>v.toLowerCase().includes(query.toLowerCase())));
 const current=selected.startsWith(`${stamp}:`)?reviews.find(x=>`${stamp}:${x.claim.id}`===selected):undefined;
 function requestReceipt(receiptId:string){if(!current||!allowedOwner(scope,current.claim.ownerUserId)||!onRequestReceiptReview)return;const row=current.receiptStates.find(r=>r.id===receiptId);if(row)onRequestReceiptReview({tenantId:scope.tenantId,contextKey:scope.contextKey,claimId:current.claim.id,receiptId:row.id});}
 return <div className="tr-grid-wide"><section className="tr-panel"><h2>Expense and attendance evidence</h2><p className="tr-detail">Read-only verified source records; no upload, OCR, signed download or accounting settlement.</p>
 {!authorized&&<p role="status">Not authorized to view workforce evidence.</p>}{loading&&<p role="status">Loading authorized evidence…</p>}{error&&<p role="alert">{error}</p>}
 {authorized&&<><TextInput id={`${id}-filter`} labelText="Filter claims by date, claim ID or employee" value={query} onChange={e=>setQuery(e.target.value)}/>
 {!loading&&!filtered.length&&<p role="status">No permitted claims returned.</p>}
 {filtered.map(r=><div className="tr-history-row" key={r.claim.id}><div><strong>{r.claim.workDate} · {r.claim.status}</strong><p>Claim {r.claim.id} · owner {r.claim.ownerUserId}</p><p>Server total {money(r.claim.serverTotalMinor,r.claim.currency)} · calculated {money(r.computedMinor,r.claim.currency)}</p><small>Source {r.claim.sourceId} · {r.claim.asOf}</small></div><div>{r.discrepancy&&<Tag type="red">TOTAL MISMATCH</Tag>}{r.missingReceipts.length>0&&<Tag type="purple">Missing receipt evidence</Tag>}{r.overLimitLines.length>0&&<Tag type="red">Policy limit exceeded</Tag>}<Button size="sm" kind="ghost" onClick={()=>setSelected(`${stamp}:${r.claim.id}`)}>Inspect evidence</Button></div></div>)}
 </>}</section><section className="tr-panel"><h2>Source-backed evidence detail</h2>
 {!current?<p role="status">Select a permitted claim to inspect line receipts, travel and day closure.</p>:<><h3>Claim {current.claim.id}</h3>
 <p>Submitted amount: {money(current.claim.serverTotalMinor,current.claim.currency)}. Recomputed line total: {money(current.computedMinor,current.claim.currency)}.</p>
 {current.discrepancy&&<p role="alert">Mismatch or invalid value: verify with authoritative expense service before approval.</p>}
 <h4>Line items and receipt manifest</h4>{current.claim.lines.map(l=><div className="tr-history-row" key={l.id}><div><strong>{l.category} · {money(l.amountMinor,current.claim.currency)}</strong><p>Line {l.id}</p><p>Receipt: {current.receiptStates.find(r=>r.lineId===l.id)?.status??"NO VERIFIED MANIFEST"}</p>{current.overLimitLines.includes(l.id)&&<p>Policy threshold exceeded</p>}</div><Button size="sm" kind="ghost" disabled={!onRequestReceiptReview||!current.receiptStates.some(r=>r.lineId===l.id)} onClick={()=>{const r=current.receiptStates.find(r=>r.lineId===l.id);if(r)requestReceipt(r.id);}}>Request receipt review</Button></div>)}
 <h4>Travel provenance</h4>{current.travel.length?current.travel.map(t=><p key={t.sourceId}>{t.method} · {t.distanceMeters} metres · source {t.sourceId}</p>):<p>No verified travel source supplied.</p>}
 <h4>Attendance/day closure</h4>{current.attendance?<p>{current.attendance.state} · {current.attendance.dayClosed?"Closed":"Not closed"} · source {current.attendance.sourceId}</p>:<p>No verified attendance evidence supplied.</p>}
 <Button kind="secondary" onClick={()=>setSelected("")}>Close evidence</Button><p className="tr-detail">No record changes or storage operations occur in this component.</p></>}
 </section></div>;
}
