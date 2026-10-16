import {useState} from "react";
import {Button,Tag} from "@carbon/react";
import {QA_SCENARIOS,useTerrevoData} from "./TerrevoDataProvider";
export function ScenarioSwitcher(){
 const {mode,scenario,setScenario,resetScenario}=useTerrevoData();
 const [open,setOpen]=useState(false);
 if(mode!=="FUNCTIONAL_QA")return null;
 const current=QA_SCENARIOS.find(x=>x.id===scenario)!;
 return <aside className={"tr-qa-switcher"+(open?" is-open":"")} data-testid="qa-scenario-switcher">
   <Button size="sm" kind="secondary" data-testid="qa-scenario-toggle" onClick={()=>setOpen(x=>!x)}>{open?"Close QA":"QA Scenario"}</Button>
   {open&&<div className="tr-panel" style={{position:"fixed",right:16,bottom:64,zIndex:999,width:340,maxHeight:"70vh",overflow:"auto"}}>
     <span className="tr-section-kicker">FUNCTIONAL QA DATASET</span><h3>{current.label}</h3><p className="tr-detail">{current.description}</p><Tag type="purple">{scenario}</Tag>
     <div className="tr-list-sm">{QA_SCENARIOS.map(s=><Button key={s.id} kind={s.id===scenario?"primary":"ghost"} size="sm" data-testid={"qa-scenario-"+s.id.toLowerCase()} onClick={()=>setScenario(s.id)}>{s.label}</Button>)}</div>
     <Button kind="tertiary" size="sm" data-testid="qa-scenario-reset" onClick={resetScenario}>Reset current scenario</Button>
   </div>}
 </aside>;
}
