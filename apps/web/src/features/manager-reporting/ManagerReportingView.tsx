import {useEffect,useId,useMemo,useState} from "react";
import {Button,Tag} from "@carbon/react";
import {canViewReports,reportRows,type ReportFilter,type ReportViewProps} from "./model";
export type {ReportViewProps,ReportScope,ReportRecord,ReportFilter,MetricCounts} from "./model";
export {reportRows,reportCsv,csvCell,canViewReports} from "./model";
const initial:ReportFilter={from:"",to:"",territoryId:"",ownerUserId:""};
export function ManagerReportingView({scope,records=[],loading=false,error,onRequestCsv}:ReportViewProps){
 const [filter,setFilter]=useState<ReportFilter>(initial);const id=useId();
 const stamp=`${scope.tenantId}:${scope.authorizedForTenantId}:${scope.contextKey}:${scope.role}:${scope.permittedTerritoryIds.join(",")}:${scope.permittedTeamUserIds.join(",")}`;
 useEffect(()=>setFilter(initial),[stamp]);
 const authorized=canViewReports(scope);const result=useMemo(()=>reportRows(scope,records,filter),[scope,records,filter]);
 const updates=(key:keyof ReportFilter,value:string)=>setFilter(old=>({...old,[key]:value}));
 const cards:[string,number|string][]=[["Planned stops",result.counts.plannedStops],["Completed planned stops",result.counts.completedPlanned],["Unplanned pending",result.counts.unplannedPending],["Unplanned approved",result.counts.unplannedApproved],["Unplanned rejected",result.counts.unplannedRejected],["NCA reports",result.counts.ncaReported],["DCR submitted",result.counts.dcrSubmitted],["Plan completion",result.counts.plannedCompletionPercent===null?"N/A":`${result.counts.plannedCompletionPercent}%`]];
 return <div className="tr-grid-wide"><section className="tr-panel"><h2>Manager field performance</h2><p className="tr-detail">Source-projected reporting only. NCA and unplanned approvals are distinct from completed planned calls.</p>
 {!authorized&&<p role="status">Manager or administrator access and authorized territory/team are required.</p>}{loading&&<p role="status">Loading source reports…</p>}{error&&<p role="alert">{error}</p>}
 {authorized&&<><p>Source data as of {scope.asOf}. No figures are extrapolated.</p>
 <div className="tr-form"><label htmlFor={`${id}-from`}>Work date from</label><input id={`${id}-from`} type="date" value={filter.from} onChange={e=>updates("from",e.target.value)}/>
 <label htmlFor={`${id}-to`}>Work date to</label><input id={`${id}-to`} type="date" min={filter.from||undefined} value={filter.to} onChange={e=>updates("to",e.target.value)}/>
 <label htmlFor={`${id}-territory`}>Territory</label><select id={`${id}-territory`} className="tr-select" value={filter.territoryId} onChange={e=>updates("territoryId",e.target.value)}><option value="">All authorized territories</option>{scope.permittedTerritoryIds.map(t=><option key={t} value={t}>{t}</option>)}</select>
 <label htmlFor={`${id}-user`}>Team member</label><select id={`${id}-user`} className="tr-select" value={filter.ownerUserId} onChange={e=>updates("ownerUserId",e.target.value)}><option value="">All authorized users</option>{scope.permittedTeamUserIds.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
 <div className="tr-list-sm">{cards.map(([name,value])=><div className="tr-history-row" key={name}><strong>{name}</strong><strong>{value}</strong></div>)}</div>
 <p role="status">{result.rows.length} authorized evidence rows; {result.excluded} excluded by permissions, filters or source validation.</p>
 <Button disabled={!onRequestCsv||result.rows.length===0||loading} onClick={()=>onRequestCsv?.({tenantId:scope.tenantId,contextKey:scope.contextKey,filter:{...filter},sourceIds:result.rows.map(r=>r.sourceId)})}>Request authorized CSV</Button>
 {!onRequestCsv&&<p className="tr-detail">Export requires a server-authorized report/CSV contract. Nothing is downloaded automatically.</p>}</>}
 </section><section className="tr-panel"><h2>Audit-linked activity ledger</h2>
 {!authorized?<p role="status">No authorized reporting scope.</p>:!loading&&!result.rows.length?<p role="status">No verified records for these filters.</p>:<div className="tr-list-sm">{result.rows.map(r=><div className="tr-history-row" key={`${r.kind}:${r.id}`}><div><strong>{r.workDate} · {r.kind}</strong><p>{r.territoryId} · {r.ownerUserId} · {r.status}</p><small>Source: {r.sourceType} / {r.sourceId}</small></div><Tag type={r.status==="REJECTED"?"red":r.status==="APPROVED"||r.status==="COMPLETED"?"green":"gray"}>{r.status}</Tag></div>)}</div>}
 </section></div>;
}
