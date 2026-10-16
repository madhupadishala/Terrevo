import {useEffect,useMemo,useState} from "react";
import {Button,Tag} from "@carbon/react";
import {buildTodaySummary,visibleSuggestions,type TodayIntelligenceViewProps} from "./model";
export type {TodayIntelligenceViewProps,AiSuggestion,TodaySummary} from "./model";
export {buildTodaySummary,visibleSuggestions} from "./model";
export function TodayIntelligenceView({tenantId,authorizedForTenantId,contextKey,progress,startOptions,manager,aiSuggestions=[],todayLocalDate,loading=false,error,onOpenPlan,onOpenStop,onConfirmSuggestion}:TodayIntelligenceViewProps){
 const [review,setReview]=useState<{tenantId:string;contextKey:string;id:string}|null>(null);
 useEffect(()=>setReview(null),[tenantId,contextKey]);
 const authorized=Boolean(tenantId&&contextKey&&authorizedForTenantId===tenantId);
 const summary=useMemo(()=>buildTodaySummary(todayLocalDate,authorized?progress:null,authorized?startOptions:[],authorized?manager:null),[todayLocalDate,authorized,progress,startOptions,manager]);
 const suggestions=useMemo(()=>authorized?visibleSuggestions(tenantId,aiSuggestions):[],[authorized,tenantId,aiSuggestions]);
 const candidate=review?.tenantId===tenantId&&review.contextKey===contextKey?suggestions.find(x=>x.id===review.id):undefined;
 return <div className="tr-grid-wide">
 <section className="tr-panel"><span className="tr-section-kicker">TODAY</span><h2>Field execution briefing</h2><p className="tr-detail">For {todayLocalDate}. All figures require authorized operational records.</p>
 {!authorized&&<p role="status">Select an authorized organization to view today's work.</p>}
 {loading&&<p role="status">Loading authorized operational data…</p>}
 {error&&<p role="alert">{error}</p>}
 <p role="status">{summary.message}</p>
 {summary.hasVerifiedTour&&<div className="tr-list-sm">
 <div className="tr-history-row"><strong>Planned calls</strong><span>{summary.planned}</span></div>
 <div className="tr-history-row"><strong>Completed visits</strong><span>{summary.completed}</span></div>
 <div className="tr-history-row"><strong>Pending stops</strong><span>{summary.pending}</span></div>
 <h3>Next pending field stops</h3>
 {summary.nextStops.length?summary.nextStops.map(stop=><div className="tr-history-row" key={stop.planStopId}>
 <div><strong>{stop.targetName}</strong><p>{stop.type} · {stop.status}</p></div>
 {onOpenStop&&<Button kind="ghost" size="sm" onClick={()=>onOpenStop(stop.planStopId)}>Open existing stop</Button>}
 </div>):<p>No remaining stops returned for this tour.</p>}</div>}
 <h3>Start options for today</h3>{summary.startOptions.length?summary.startOptions.map(x=><div className="tr-history-row" key={x.planDayId}>
 <div><strong>Scheduled tour</strong><p>Territory {x.territoryId}</p></div>
 {onOpenPlan&&<Button kind="ghost" size="sm" onClick={()=>onOpenPlan(x.planId,x.planDayId)}>Review plan</Button>}</div>):<p>No verified start options for today.</p>}
 <h3>Manager pending actions</h3>{summary.managerPending.length?summary.managerPending.map(p=><div className="tr-history-row" key={p.name}><strong>{p.name}</strong><Tag type="purple">{p.count}</Tag></div>):<p>No manager pending data supplied for today.</p>}
 </section>
 <section className="tr-panel"><span className="tr-section-kicker">AI-READY BRIEFING</span><h2>Evidence-backed suggestions</h2>
 <p className="tr-detail">No model is called in this view. Suggestions must be supplied by an authorized service, with provenance and uncertainty. Human approval is required.</p>
 {!suggestions.length&&<p role="status">No validated suggestions available.</p>}
 {suggestions.map(s=><div className="tr-history-row" key={s.id}><div><strong>{s.summary}</strong><p>{s.reason}</p><p>Source: {s.sourceType} · {s.sourceObservedAt}</p>
 <p>{s.uncertainty}</p></div><Button kind="ghost" size="sm" onClick={()=>setReview({tenantId,contextKey,id:s.id})}>Inspect evidence</Button></div>)}
 {candidate&&<div role="region" aria-label="Suggestion review"><h3>Review: {candidate.summary}</h3>
 <p>Requested action: <strong>{candidate.actionType}</strong></p><p>Source identifier: {candidate.sourceId}</p><p>Confidence: {candidate.confidence===null?"Not supplied":Math.round(candidate.confidence*100)+"%"}</p>
 <p>Uncertainty: {candidate.uncertainty}</p><h4>Evidence</h4>{candidate.evidence.map((e,i)=><p key={i}>{e.label}: {e.reference}</p>)}
 <p>No action is automatic. Confirmation sends a request to the parent; authorization and audit remain server responsibilities.</p>
 <Button kind="secondary" onClick={()=>setReview(null)}>Close review</Button>
 <Button disabled={!onConfirmSuggestion} onClick={()=>{if(onConfirmSuggestion){onConfirmSuggestion(candidate);setReview(null);}}}>Confirm for human action</Button>
 {!onConfirmSuggestion&&<p>Action contract is unavailable; confirmation is disabled.</p>}</div>}
 </section></div>;
}
