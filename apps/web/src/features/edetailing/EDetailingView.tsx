import {useEffect,useMemo,useRef,useState} from "react";
import {Button,Tag,TextInput} from "@carbon/react";
import {useClm} from "../../qa/TerrevoDataProvider";
import {clampSlideIndex,createDetailingSessionDraft,eligibleAssets,assetContentIdentity,type EDetailingViewProps,type ApprovedAsset,type SlideVisit} from "./model";
export type {EDetailingViewProps,ApprovedAsset,DetailingSessionDraft,ApprovedSlide,SlideVisit} from "./model";
export {eligibleAssets,isEligibleApprovedAsset,clampSlideIndex,createDetailingSessionDraft,assetContentIdentity} from "./model";
type Viewing = {tenantId:string;contextKey:string;assetId:string;assetContentId:string;linkedVisitId?:string;providerSessionId?:string;index:number;mode:"REHEARSAL"|"DETAILING";startedAt:string;enteredAt:number;visits:SlideVisit[];endedAt?:string};
export function EDetailingView({tenantId,contextKey,authorizedForTenantId,assets=[],products=[],today,linkedVisitId,onSaveSessionDraft,loading=false}:EDetailingViewProps){
 const qa=useClm();
 const providerAssets:ApprovedAsset[]=qa.assets.map(a=>({id:a.id,tenantId,title:a.title,productIds:a.productIds,category:a.category,status:a.status,slides:a.slides,effectiveFrom:a.effectiveFrom,expiresAt:a.expiresAt}));
 const effectiveAssets=assets.length?assets:providerAssets;
 const effectiveLinkedVisitId=linkedVisitId??(qa.activeVisit?.customerType==="DOCTOR"?qa.activeVisit.id:undefined);
 const localDate=today||[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,"0"),String(new Date().getDate()).padStart(2,"0")].join("-");
 const authorized=Boolean(tenantId&&contextKey&&authorizedForTenantId===tenantId);
 const validAssets=useMemo(()=>authorized?eligibleAssets(effectiveAssets,tenantId,localDate):[],[authorized,effectiveAssets,tenantId,localDate]);
 const [search,setSearch]=useState(""),[product,setProduct]=useState(""),[category,setCategory]=useState(""),[reaction,setReaction]=useState<"POSITIVE"|"NEUTRAL"|"NEGATIVE">("NEUTRAL");
 const [viewing,setViewing]=useState<Viewing|null>(null),[review,setReview]=useState(false),[message,setMessage]=useState("");
 const [saving,setSaving]=useState(false),[handedOff,setHandedOff]=useState(false);
 // An asynchronous completion belongs to the exact asset/tenant session that started it.
 const epoch=useRef(0);
 const activeContext=useRef({tenantId,contextKey});
 if(activeContext.current.tenantId!==tenantId||activeContext.current.contextKey!==contextKey){
  epoch.current++;
  activeContext.current={tenantId,contextKey};
 }
 useEffect(()=>{setViewing(null);setSearch("");setProduct("");setCategory("");setReview(false);setMessage("");setSaving(false);setHandedOff(false);},[tenantId,contextKey]);
 const results=validAssets.filter(a=>(!search||a.title.toLowerCase().includes(search.toLowerCase()))&&(!category||a.category===category)&&(!product||a.productIds.includes(product)));
 const selected=viewing?.tenantId===tenantId&&viewing.contextKey===contextKey?
  validAssets.find(x=>x.id===viewing.assetId&&assetContentIdentity(x)===viewing.assetContentId):undefined;
 useEffect(()=>{if(viewing&&!selected){epoch.current++;setViewing(null);setReview(false);setHandedOff(false);setSaving(false);}},[viewing,selected]);
 const categories=[...new Set(validAssets.map(x=>x.category))].sort();
 const usableProducts=products.filter(x=>validAssets.some(a=>a.productIds.includes(x.id)));
 const visited=(state:Viewing,asset:ApprovedAsset,now:number):SlideVisit[]=>{
  const slide=asset.slides[state.index];const elapsed=Math.max(0,now-state.enteredAt);
  return [...state.visits,{slideId:slide.id,durationMs:Math.round(elapsed)}];
 };
 function choose(asset:ApprovedAsset,mode:"REHEARSAL"|"DETAILING"){
   try{
     const providerSessionId=qa.start(asset.id,mode);
     epoch.current++;setViewing({tenantId,contextKey,assetId:asset.id,assetContentId:assetContentIdentity(asset),linkedVisitId:effectiveLinkedVisitId,providerSessionId,mode,index:0,startedAt:new Date().toISOString(),enteredAt:Date.now(),visits:[]});setReview(false);setMessage("");setSaving(false);setHandedOff(false);
   }catch(e){setMessage(e instanceof Error?e.message:"Unable to start CLM session.");}
 }
 function navigate(delta:number){
  if(!viewing||!selected||review||viewing.endedAt)return;
  const next=clampSlideIndex(viewing.index+delta,selected.slides.length);
  if(next===viewing.index)return;
  const now=Date.now();setViewing({...viewing,index:next,enteredAt:now,visits:visited(viewing,selected,now)});
 }
 const draft=selected&&viewing&&viewing.mode==="DETAILING"&&viewing.endedAt?createDetailingSessionDraft(tenantId,selected,viewing.startedAt,viewing.endedAt,viewing.visits,viewing.linkedVisitId):null;
 async function save(){
  if(!review||!draft||!onSaveSessionDraft||saving||handedOff)return;
  const savingEpoch=epoch.current;
  setSaving(true);setMessage("");
  try{
    if(onSaveSessionDraft)await onSaveSessionDraft(draft);
    if(viewing?.providerSessionId)qa.finish(viewing.providerSessionId,reaction,draft.slideVisits);
    if(epoch.current!==savingEpoch)return;
    setHandedOff(true);setMessage("Session draft passed to the parent callback; server recording remains unverified.");setReview(false);
  }catch(e){
    if(epoch.current===savingEpoch)setMessage(e instanceof Error?e.message:"Session draft handoff failed.");
  }finally{
    if(epoch.current===savingEpoch)setSaving(false);
  }
 }
 return <div className="tr-grid-wide">
 <section className="tr-panel"><span className="tr-section-kicker">CONTROLLED CONTENT LIBRARY</span><h2>E-detailing / CLM</h2>
 <Tag type="purple">Approved assets only</Tag>
 {!authorized&&<p role="status">Select an authorized tenant before viewing content.</p>}
 {loading&&<p role="status">Loading authorized content…</p>}
 <div className="tr-form" data-testid="clm-filters"><TextInput id="detail-search" data-testid="clm-search" labelText="Search approved content" value={search} onChange={e=>setSearch(e.target.value)}/>
 <label htmlFor="detail-product">Product</label><select id="detail-product" data-testid="clm-product" className="tr-select" value={product} onChange={e=>setProduct(e.target.value)}><option value="">All authorized products</option>{usableProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <label htmlFor="detail-category">Category</label><select id="detail-category" data-testid="clm-category" className="tr-select" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
 {!results.length&&!loading&&<p role="status">No approved content available for these filters.</p>}
 <div className="tr-list-sm" data-testid="clm-asset-list">{results.map(asset=><div className="tr-history-row" key={asset.id}><div><strong>{asset.title}</strong><p>{asset.category} · {asset.slides.length} approved slides</p></div>
 <div><Button size="sm" kind="ghost" data-testid={"clm-rehearse-"+asset.id} onClick={()=>choose(asset,"REHEARSAL")}>Rehearse</Button><Button size="sm" kind="secondary" data-testid={"clm-detail-"+asset.id} onClick={()=>choose(asset,"DETAILING")}>Start detailing</Button></div></div>)}</div>
 </section>
 <section className="tr-panel"><span className="tr-section-kicker">PRESENTATION VIEWER</span>
 {!selected||!viewing?<p className="tr-detail">Select approved content to begin a local-only viewing session.</p>:<>
 <h2>{selected.title}</h2><Tag type="green">Approved</Tag><Tag type={viewing.mode==="REHEARSAL"?"gray":"blue"}>{viewing.mode==="REHEARSAL"?"Rehearsal — no engagement report":"Detailing session"}</Tag>
 <div tabIndex={0} role="region" aria-label="Approved slide viewer" onKeyDown={e=>{if(e.key==="ArrowRight"){e.preventDefault();navigate(1);}if(e.key==="ArrowLeft"){e.preventDefault();navigate(-1);}}}>
 <h3>{selected.slides[viewing.index].title}</h3><p style={{whiteSpace:"pre-wrap"}}>{selected.slides[viewing.index].body}</p>
 <p role="status">Slide {viewing.index+1} of {selected.slides.length}</p>
 <Button kind="secondary" data-testid="clm-prev-slide" disabled={review||viewing.index===0} onClick={()=>navigate(-1)}>Previous slide</Button>
 <Button data-testid="clm-next-slide" disabled={review||viewing.index===selected.slides.length-1} onClick={()=>navigate(1)}>Next slide</Button></div>
 {!review&&(viewing.mode==="REHEARSAL"?<Button kind="secondary" onClick={()=>setViewing(null)}>End rehearsal</Button>:
 !viewing.endedAt?<Button kind="tertiary" data-testid="clm-end-detailing" onClick={()=>{const now=Date.now();setViewing({...viewing,endedAt:new Date().toISOString(),visits:visited(viewing,selected,now)});}}>End detailing</Button>:
 <Button kind="tertiary" onClick={()=>setReview(true)}>Review ended session</Button>)}
 {review&&draft&&<>
 <h3>Session review</h3><p>Asset: {selected.title}</p><label htmlFor="detail-reaction">Doctor reaction</label><select id="detail-reaction" data-testid="clm-reaction" className="tr-select" value={reaction} onChange={e=>setReaction(e.target.value as typeof reaction)}><option value="POSITIVE">Positive</option><option value="NEUTRAL">Neutral</option><option value="NEGATIVE">Negative</option></select>
 <p>Slide engagement is an in-memory estimate, not a persisted audit record.</p>
 {draft?.slideVisits.map((v,i)=><p key={i}>Slide {v.slideId}: {Math.round(v.durationMs/1000)} seconds</p>)}
 <Button kind="secondary" disabled={saving} onClick={()=>setReview(false)}>Return to viewer</Button>
 <Button data-testid="clm-save-session" disabled={saving||handedOff||(!onSaveSessionDraft&&!viewing.providerSessionId)} onClick={()=>void save()}>{saving?"Handing off…":handedOff?"Draft handed off":"Hand off session draft"}</Button>
 {!onSaveSessionDraft&&<p>No approved session recording API is connected. Draft cannot be saved.</p>}</>}
 {handedOff&&<p role="status">Draft handoff completed in this session. Start a new detailing session for another draft.</p>}
 {message&&<p role="status">{message}</p>}
 </>}</section></div>;
}
