import assert from "node:assert/strict";
import test from "node:test";
import {AGENT_REGISTRY,getAgentDefinition,runAgent,type AgentRequest} from "../src/index.ts";

const evidence=[{source_type:"task",source_id:"task-1",observed_at:"2026-10-13T00:00:00+05:30"}];

test("registry contains the exact 15 V3.2 agents with unique ids",()=>{
  assert.equal(AGENT_REGISTRY.length,15);
  assert.equal(new Set(AGENT_REGISTRY.map(a=>a.id)).size,15);
  assert.equal(getAgentDefinition("AI-01").name,"Daily Briefing");
  assert.equal(getAgentDefinition("AI-15").name,"Analytics Assistant");
});

test("Daily Briefing returns only supplied evidence-backed baseline data and requires review",()=>{
  const request:AgentRequest={contract_version:"1.0",agent_id:"AI-01",request_id:"r1",input:{
    evidence,priorities:[{task_id:"task-1",reason:"Persisted overdue task",due_at:"2026-10-12T10:00:00+05:30",urgency:"high",evidence_ids:["task-1"]}],
    missed_commitments:[],summary:"One persisted task needs attention."
  }};
  const out=runAgent(request,{tenantId:"tenant-a",actorId:"mr-a",roles:["MR"],allowedSourceIds:new Set(["task-1"]),now:"2026-10-13T04:00:00+05:30"});
  assert.equal(out.state,"needs_review");assert.equal(out.requires_human_confirmation,true);assert.equal(out.evidence[0]?.source_id,"task-1");
  assert.deepEqual((out.result as Record<string,unknown>).priorities,request.input.priorities);
});

test("cross-scope evidence is rejected instead of producing an answer",()=>{
  const request:AgentRequest={contract_version:"1.0",agent_id:"AI-15",request_id:"r2",input:{evidence,answer:"42",metrics:[],limitations:[]}};
  const out=runAgent(request,{tenantId:"tenant-a",actorId:"manager-a",roles:["MANAGER"],allowedSourceIds:new Set(["different-source"])});
  assert.equal(out.state,"insufficient_evidence");assert.equal(out.result,null);assert.equal(out.error?.code,"NO_EVIDENCE");
});

test("role policy fails closed",()=>{
  const request:AgentRequest={contract_version:"1.0",agent_id:"AI-05",request_id:"r3",input:{evidence,insights:[{metric_id:"coverage"}],exceptions:[],recommended_reviews:[]}};
  const denied=runAgent(request,{tenantId:"tenant-a",actorId:"mr-a",roles:["MR"],allowedSourceIds:new Set(["task-1"])});
  assert.equal(denied.state,"denied");assert.equal(denied.error?.code,"DENIED");
  const manager=runAgent(request,{tenantId:"tenant-a",actorId:"manager-a",roles:["MANAGER"],allowedSourceIds:new Set(["task-1"])});
  assert.equal(manager.state,"needs_review");
});

test("empty observations never return completed",()=>{
  const request:AgentRequest={contract_version:"1.0",agent_id:"AI-14",request_id:"r4",input:{evidence,issues:[],merge_candidates:[]}};
  const out=runAgent(request,{tenantId:"tenant-a",actorId:"admin-a",roles:["TENANT_ADMIN"],allowedSourceIds:new Set(["task-1"])});
  assert.equal(out.state,"insufficient_evidence");assert.notEqual(out.state,"completed");assert.equal(out.result,null);
});

test("all 15 result contracts can run without external models or writes when evidence-backed",()=>{
  const payloads:Record<string,Record<string,unknown>>={
    "AI-01":{priorities:[{task_id:"x"}],missed_commitments:[],summary:"x"},
    "AI-02":{proposed_visits:[{customer_id:"x"}],constraint_violations:[],feasibility:"feasible"},
    "AI-03":{briefing_sections:["x"],last_contact_at:null,open_actions:[],approved_material_ids:[],evidence_ids:["task-1"]},
    "AI-04":{draft_sections:["x"],reconciliation:[],warnings:[],source_event_ids:["task-1"]},
    "AI-05":{insights:[{metric_id:"x"}],exceptions:[],recommended_reviews:[]},
    "AI-06":{findings:[{rule_id:"x"}],manual_review_ids:["x"]},
    "AI-07":{trends:[{brand_id:"x"}],limitations:[],suggested_checks:[]},
    "AI-08":{engagement_gaps:["x"],followup_suggestions:[],link_warnings:[]},
    "AI-09":{suggestions:[{asset_id:"x"}],excluded_asset_reasons:[]},
    "AI-10":{flags:[{claim_id:"x"}],possible_duplicates:[],reviewer_questions:[]},
    "AI-11":{forecasts:[{sku_id:"x"}],exceptions:[],reorder_suggestions:[]},
    "AI-12":{opportunities:[{territory_id:"x"}],caveats:[]},
    "AI-13":{draft_actions:[{title:"x"}],ambiguous_items:[]},
    "AI-14":{issues:[{record_id:"x"}],merge_candidates:[]},
    "AI-15":{answer:"x",metrics:[],data_as_of:"2026-10-13T00:00:00+05:30",limitations:[],chart_spec:null},
  };
  const roleFor=(id:string)=>["AI-05","AI-12"].includes(id)?"MANAGER":["AI-06","AI-14"].includes(id)?"TENANT_ADMIN":["AI-10"].includes(id)?"MANAGER":"MR";
  for(const def of AGENT_REGISTRY){
    const request={contract_version:"1.0",agent_id:def.id,request_id:def.id,input:{evidence,...payloads[def.id]}} as AgentRequest;
    const out=runAgent(request,{tenantId:"tenant-a",actorId:"actor",roles:[roleFor(def.id) as any],allowedSourceIds:new Set(["task-1"])});
    assert.equal(out.state,"needs_review",def.id);
    assert.deepEqual(Object.keys(out.result as Record<string,unknown>),[...def.resultKeys],def.id);
  }
});
