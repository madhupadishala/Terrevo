import {useEffect,useMemo,useState} from "react";
import {Button,Tag,TextInput} from "@carbon/react";
import {clampSlideIndex,createDetailingSessionDraft,eligibleAssets,type EDetailingViewProps,type ApprovedAsset,type SlideVisit} from "./model";
export type {EDetailingViewProps,ApprovedAsset,DetailingSessionDraft,ApprovedSlide,SlideVisit} from "./model";
export {eligibleAssets,isEligibleApprovedAsset,clampSlideIndex,createDetailingSessionDraft} from "./model";
type Viewing = {scope:string;assetId:string;index:number;mode:"REHEARSAL"|"DETAILING";startedAt:string;enteredAt:number;visits:SlideVisit[];endedAt?:string};
export function EDetailingView({tenantId,contextKey,authorizedForTenantId,assets=[],products=[],today,linkedVisitId,onSaveSessionDraft,loading=false}:EDetailingViewProps){
 const scope=tenantId+":"+contextKey;
 const localDate=today||[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,"0"),String(new Date().getDate()).padStart(2,"0")].join("-");
 const authorized=Boolean(tenantId&&contextKey&&authorizedForTenantId===tenantId);
 const validAssets=useMemo(()=>authorized?eligibleAssets(assets,tenantId,localDate):[],[authorized,assets,tenantId,localDate]);
 const [search,setSearch]=useState(""),[product,setProduct]=useState(""),[category,setCategory]=useState("");
 const [viewing,setViewing]=useState<Viewing|null>(null),[review,setReview]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{setViewing(null);setSearch("");setProduct("");setCategory("");setReview(false);setMessage("");},[scope]);
 const results=validAssets.filter(a=>(!search||a.title.toLowerCase().includes(search.toLowerCase()))&&(!category||a.category===category)&&(!product||a.productIds.includes(product)));
 const selected=viewing?.scope===scope?validAssets.find(x=>x.id===viewing.assetId):undefined;
 const categories=[...new Set(validAssets.map(x=>x.category))].sort();
 const usableProducts=products.filter(x=>validAssets.some(a=>a.productIds.includes(x.id)));
 const visited=(state:Viewing,asset:ApprovedAsset,now:number):SlideVisit[]=>{
  const slide=asset.slides[state.index];const elapsed=Math.max(0,now-state.enteredAt);
  return [...state.visits,{slideId:slide.id,durationMs:Math.round(elapsed)}];
 };
 function choose(asset:ApprovedAsset,mode:"REHEARSAL"|"DETAILING"){setViewing({scope,assetId:asset.id,mode,index:0,startedAt:new Date().toISOString(),enteredAt:Date.now(),visits:[]});setReview(false);setMessage("");}
 function navigate(delta:number){
  if(!viewing||!selected||review||viewing.endedAt)return;
  const next=clampSlideIndex(viewing.index+delta,selected.slides.length);
  if(next===viewing.index)return;
  const now=Date.now();setViewing({...viewing,index:next,enteredAt:now,visits:visited(viewing,selected,now)});
 }
 const draft=selected&&viewing&&viewing.mode==="DETAILING"&&viewing.endedAt?createDetailingSessionDraft(tenantId,selected,viewing.startedAt,viewing.endedAt,viewing.visits,linkedVisitId):null;
 async function save(){
  if(!review||!draft||!onSaveSessionDraft)return;
  try{await onSaveSessionDraft(draft);setMessage("Session draft passed to the parent callback; server recording remains unverified.");setReview(false);}
  catch(e){setMessage(e instanceof Error?e.message:"Session draft handoff failed.");}
 }
 return <div className="tr-grid-wide">
 <section className="tr-panel"><span className="tr-section-kicker">CONTROLLED CONTENT LIBRARY</span><h2>E-detailing / CLM</h2>
 <Tag type="purple">Approved assets only</Tag>
 {!authorized&&<p role="status">Select an authorized tenant before viewing content.</p>}
 {loading&&<p role="status">Loading authorized content…</p>}
 <div className="tr-form"><TextInput id="detail-search" labelText="Search approved content" value={search} onChange={e=>setSearch(e.target.value)}/>
 <label htmlFor="detail-product">Product</label><select id="detail-product" className="tr-select" value={product} onChange={e=>setProduct(e.target.value)}><option value="">All authorized products</option>{usableProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <label htmlFor="detail-category">Category</label><select id="detail-category" className="tr-select" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
 {!results.length&&!loading&&<p role="status">No approved content available for these filters.</p>}
 <div className="tr-list-sm">{results.map(asset=><div className="tr-history-row" key={asset.id}><div><strong>{asset.title}</strong><p>{asset.category} · {asset.slides.length} approved slides</p></div>
 <div><Button size="sm" kind="ghost" onClick={()=>choose(asset,"REHEARSAL")}>Rehearse</Button><Button size="sm" kind="secondary" onClick={()=>choose(asset,"DETAILING")}>Start detailing</Button></div></div>)}</div>
 </section>
 <section className="tr-panel"><span className="tr-section-kicker">PRESENTATION VIEWER</span>
 {!selected||!viewing?<p className="tr-detail">Select approved content to begin a local-only viewing session.</p>:<>
 <h2>{selected.title}</h2><Tag type="green">Approved</Tag><Tag type={viewing.mode==="REHEARSAL"?"gray":"blue"}>{viewing.mode==="REHEARSAL"?"Rehearsal — no engagement report":"Detailing session"}</Tag>
 <div tabIndex={0} role="region" aria-label="Approved slide viewer" onKeyDown={e=>{if(e.key==="ArrowRight"){e.preventDefault();navigate(1);}if(e.key==="ArrowLeft"){e.preventDefault();navigate(-1);}}}>
 <h3>{selected.slides[viewing.index].title}</h3><p style={{whiteSpace:"pre-wrap"}}>{selected.slides[viewing.index].body}</p>
 <p role="status">Slide {viewing.index+1} of {selected.slides.length}</p>
 <Button kind="secondary" disabled={review||viewing.index===0} onClick={()=>navigate(-1)}>Previous slide</Button>
 <Button disabled={review||viewing.index===selected.slides.length-1} onClick={()=>navigate(1)}>Next slide</Button></div>
 {!review&&(viewing.mode==="REHEARSAL"?<Button kind="secondary" onClick={()=>setViewing(null)}>End rehearsal</Button>:
 !viewing.endedAt?<Button kind="tertiary" onClick={()=>{const now=Date.now();setViewing({...viewing,endedAt:new Date().toISOString(),visits:visited(viewing,selected,now)});}}>End detailing</Button>:
 <Button kind="tertiary" onClick={()=>setReview(true)}>Review ended session</Button>)}
 {review&&draft&&<>
 <h3>Session review</h3><p>Asset: {selected.title}</p>
 <p>Slide engagement is an in-memory estimate, not a persisted audit record.</p>
 {draft?.slideVisits.map((v,i)=><p key={i}>Slide {v.slideId}: {Math.round(v.durationMs/1000)} seconds</p>)}
 <Button kind="secondary" onClick={()=>setReview(false)}>Return to viewer</Button>
 <Button disabled={!onSaveSessionDraft} onClick={()=>void save()}>Hand off session draft</Button>
 {!onSaveSessionDraft&&<p>No approved session recording API is connected. Draft cannot be saved.</p>}</>}
 {message&&<p role="status">{message}</p>}
 </>}</section></div>;
}
