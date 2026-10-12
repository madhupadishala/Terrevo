import assert from "node:assert/strict";
import test from "node:test";
import {buildDeterministicAgentInput} from "../src/server-input.ts";

test("Daily Briefing is derived only from approved start options",()=>{
 const input=buildDeterministicAgentInput("AI-01",{startOptions:[{planDayId:"day-1",workDate:"2026-10-13",territoryId:"terr-1"}]});
 assert.equal((input.evidence as any[])[0].source_id,"day-1");
 assert.deepEqual((input.priorities as any[])[0].evidence_ids,["day-1"]);
 assert.equal(input.summary,"1 approved tour day(s) available.");
});

test("Manager Intelligence exposes scoped computed metrics as evidence-backed observations",()=>{
 const input=buildDeterministicAgentInput("AI-05",{analytics:{tours:{submitted:2},coverage:{plannedStops:4,completedVisits:3,doctorCalls:2}}});
 assert.equal((input.insights as any[]).length,4);
 assert.ok((input.insights as any[]).every(x=>x.evidence_ids[0]==="manager-analytics"));
});

test("CLM Intelligence excludes non-approved and out-of-window content",()=>{
 const input=buildDeterministicAgentInput("AI-09",{clmAssets:[
  {id:"a1",status:"APPROVED",version:"1",productIds:["p1"],regionCodes:["GLOBAL"],effectiveFrom:"2026-01-01",expiresAt:"2099-01-01"},
  {id:"a2",status:"WITHDRAWN",version:"1",productIds:["p1"],regionCodes:["GLOBAL"]},
 ]});
 assert.deepEqual((input.suggestions as any[]).map(x=>x.asset_id),["a1"]);
 assert.deepEqual((input.evidence as any[]).map(x=>x.source_id),["a1"]);
});

test("Field Data Quality reports duplicate master codes but never merges automatically",()=>{
 const input=buildDeterministicAgentInput("AI-14",{masters:{doctors:[
  {id:"d1",code:"DOC-1",name:"A",status:"active"},{id:"d2",code:"doc-1",name:"B",status:"active"}
 ]}});
 assert.equal((input.issues as any[]).length,2);
 assert.equal((input.merge_candidates as any[]).length,1);
 assert.match(String((input.issues as any[])[0].suggested_fix),/no automatic merge/i);
});

test("unsupported source adapter yields no evidence rather than a fabricated result",()=>{
 assert.deepEqual(buildDeterministicAgentInput("AI-12",{}),{evidence:[]});
});


test("Tour Planning proposes only doctors whose controlled territory has an approved day",()=>{
 const input=buildDeterministicAgentInput("AI-02",{
  startOptions:[{planDayId:"day-1",workDate:"2026-10-14",territoryId:"terr-1"}],
  doctors:[
   {id:"d1",territoryId:"terr-1",visitFrequency:2},
   {id:"d2",territoryId:"terr-2",visitFrequency:1},
  ],
 });
 assert.deepEqual((input.proposed_visits as any[]).map(x=>x.customer_id),["d1"]);
 assert.equal((input.proposed_visits as any[])[0].visit_frequency,2);
 assert.equal(input.feasibility,"requires_human_review");
});

test("Follow-up Action uses only an explicitly persisted nextAction",()=>{
 const input=buildDeterministicAgentInput("AI-13",{doctorCall:{id:"call-1",nextAction:"Follow up in two weeks",callOutcome:"Discussed",updatedAt:"2026-10-13T00:00:00Z"}});
 assert.deepEqual((input.draft_actions as any[]).map(x=>x.title),["Follow up in two weeks"]);
 assert.deepEqual((input.evidence as any[]).map(x=>x.source_id),["call-1"]);
 const empty=buildDeterministicAgentInput("AI-13",{doctorCall:{id:"call-2",nextAction:null,callOutcome:"Discussed"}});
 assert.deepEqual(empty.draft_actions,[]);
 assert.equal((empty.ambiguous_items as any[]).length,1);
});
