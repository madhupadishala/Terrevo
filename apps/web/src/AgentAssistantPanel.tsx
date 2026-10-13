import {useEffect,useMemo,useState} from "react";
import {Button,InlineNotification,Tag} from "@carbon/react";
import type {AgentCatalogEntry,AgentId,AgentOutput,TerrevoWebApi} from "./terrevo-api";

type Props={
 api:TerrevoWebApi;
 connected:boolean;
 contextKey:string;
 preferredAgent?:AgentId;
 subject?:{kind:string;id:string};
 title?:string;
};

const stateTag:Record<string,"green"|"blue"|"purple"|"red"|"gray">={
 completed:"green",needs_review:"blue",insufficient_evidence:"purple",denied:"red",failed:"red",
};

export function AgentAssistantPanel({api,connected,contextKey,preferredAgent,subject,title="Terrevo Agent Assistant"}:Props){
 const [agents,setAgents]=useState<AgentCatalogEntry[]>([]);
 const [selected,setSelected]=useState<AgentId|"" >("");
 const [output,setOutput]=useState<AgentOutput|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
   let active=true;setAgents([]);setSelected("");setOutput(null);setError(null);
   if(!connected||!contextKey)return()=>{active=false};
   setLoading(true);
   void api.aiAgents().then(rows=>{
     if(!active)return;setAgents(rows);
     const preferred=preferredAgent&&rows.some(x=>x.id===preferredAgent)?preferredAgent:rows[0]?.id??"";
     setSelected(preferred);
   }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Agent catalog unavailable.");})
     .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false};
 },[api,connected,contextKey,preferredAgent]);
 const definition=useMemo(()=>agents.find(x=>x.id===selected)??null,[agents,selected]);
 async function run(){
   if(!selected||!connected)return;setLoading(true);setError(null);setOutput(null);
   try{setOutput(await api.runAgent(selected,subject));}
   catch(e){setError(e instanceof Error?e.message:"Agent run failed.");}
   finally{setLoading(false);}
 }
 return <section className="tr-panel" aria-label={title}>
   <span className="tr-section-kicker">SHARED AGENT LAYER</span><h2>{title}</h2>
   <p className="tr-detail">Read-only, tenant-scoped assistance. Agent output never submits, approves, edits, or fabricates field evidence.</p>
   {!connected?<p role="status">Connect an authorized Terrevo workspace to use agents.</p>:<>
     {error&&<InlineNotification lowContrast hideCloseButton kind="error" title="Agent unavailable" subtitle={error}/>}
     <label className="tr-select-label" htmlFor="terrevo-agent-select">Authorized agent</label>
     <select id="terrevo-agent-select" className="tr-select" value={selected} disabled={loading} onChange={e=>{setSelected(e.target.value as AgentId);setOutput(null);}}>
       {agents.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
     </select>
     {definition&&<><p className="tr-detail">Authoritative sources: {definition.authoritativeDatasets.join(", ")}</p>
       <div className="tr-button-row"><Tag type={definition.priority==="P1"?"blue":"gray"}>{definition.priority}</Tag>
       <Button size="sm" disabled={loading||!selected} onClick={()=>void run()}>{loading?"Checking evidence…":"Run with authorized evidence"}</Button></div></>}
     {!loading&&agents.length===0&&!error&&<p role="status">No agent is authorized for this role.</p>}
     {output&&<div className="tr-history-row"><div><strong>{output.agent_id} · {output.state.replaceAll("_"," ")}</strong>
       <p>{output.evidence.length} evidence reference(s) · human confirmation {output.requires_human_confirmation?"required":"not required"}</p>
       {output.warnings.map((w,i)=><p key={"w"+i}>{w}</p>)}
       {output.limitations.map((w,i)=><small key={"l"+i}>{w}<br/></small>)}
       {output.result&&<details><summary>Review deterministic result</summary><pre>{JSON.stringify(output.result,null,2)}</pre></details>}
       {output.error&&<p role="alert">{output.error.message}</p>}</div><Tag type={stateTag[output.state]??"gray"}>{output.state.toUpperCase()}</Tag></div>}
   </>}
 </section>;
}
