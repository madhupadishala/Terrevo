import test from"node:test";import assert from"node:assert/strict";
import{buildScenario}from"../src/qa/qa-scenarios.ts";
import{activeVisit,bookPob,buildDcr,checkInVisit,closeVisit,decideQueue,distributeInventory,managerMetrics,pobEligibility,rcpaEligibility,saveNca,saveRcpa,startClm,finishClm,submitDcr,approvalQueue}from"../src/qa/qa-store.ts";

test("CLM detailing requires active doctor and rehearsal never enters DCR",()=>{
 let s=buildScenario("NORMAL_DAY");
 assert.throws(()=>startClm(s,"CLM-001","DETAILING"),/doctor visit/);
 s=startClm(s,"CLM-001","REHEARSAL");
 s=finishClm(s,"clm-session-1","NEUTRAL",[{slideId:"CLM-001-S1",durationMs:1000}]);
 assert.equal(buildDcr(s).clmSessionIds.length,0);
 s=checkInVisit(s,"visit-doc-01");
 s=startClm(s,"CLM-001","DETAILING");
 s=finishClm(s,"clm-session-2","POSITIVE",[{slideId:"CLM-001-S1",durationMs:1200}]);
 s=closeVisit(s,"visit-doc-01","Detailed");
 assert.deepEqual(buildDcr(s).clmSessionIds,["clm-session-2"]);
 assert.throws(()=>startClm(s,"CLM-003","REHEARSAL"),/approved/);
});

test("NCA enforces duration and cannot overlap customer check-in",()=>{
 let s=buildScenario("NORMAL_DAY");
 assert.throws(()=>saveNca(s,{repId:"rep-hyd-01",category:"MEETING",town:"Hyderabad",date:"2026-10-16",durationMinutes:15,reason:"x",remarks:"x"}),/30 minutes/);
 s=checkInVisit(s,"visit-doc-01");
 assert.throws(()=>saveNca(s,{repId:"rep-hyd-01",category:"MEETING",town:"Hyderabad",date:"2026-10-16",durationMinutes:60,reason:"x",remarks:"x"}),/overlap/);
});

test("sample distribution changes balance and becomes DCR evidence",()=>{
 let s=buildScenario("NORMAL_DAY");s=checkInVisit(s,"visit-doc-01");
 const before=s.inventory.find(x=>x.id==="SMP-01")!;
 s=distributeInventory(s,"SMP-01",3);
 const after=s.inventory.find(x=>x.id==="SMP-01")!;
 assert.equal(after.availableQty,before.availableQty-3);assert.equal(after.distributedQty,before.distributedQty+3);
 s=closeVisit(s,"visit-doc-01","Sampled");
 assert.equal(buildDcr(s).sampleDistributionIds.length,1);
 assert.throws(()=>distributeInventory(buildScenario("VALIDATION_ERRORS"),"SMP-01",1),/doctor visit|available/);
});

test("RCPA and POB are relationship gated and POB is idempotent",()=>{
 let s=buildScenario("NORMAL_DAY");
 s=checkInVisit(s,"visit-chem-01");
 assert.equal(rcpaEligibility(s).enabled,true);assert.equal(pobEligibility(s).enabled,true);
 s=saveRcpa(s,{productId:"prod-01",brandQty:60,competitorQty:40,rxCount:20});
 assert.equal(s.rcpa[0].lines[0].marketSharePct,60);
 s=bookPob(s,[{productId:"prod-01",quantity:5}],"idem-1");
 const once=s.pob.length;s=bookPob(s,[{productId:"prod-01",quantity:5}],"idem-1");assert.equal(s.pob.length,once);
 const bad=buildScenario("VALIDATION_ERRORS");
 assert.equal(rcpaEligibility(bad).enabled,false);assert.equal(pobEligibility(bad).enabled,false);
});

test("DCR is derived, requires visits closed and locks field mutations",()=>{
 let s=buildScenario("NORMAL_DAY");s=checkInVisit(s,"visit-doc-01");
 assert.throws(()=>submitDcr(s),/Close all visits/);
 s=closeVisit(s,"visit-doc-01","Done");s=checkInVisit(s,"visit-chem-01");s=closeVisit(s,"visit-chem-01","Done");s=checkInVisit(s,"visit-stock-01");s=closeVisit(s,"visit-stock-01","Done");
 s=submitDcr(s);
 assert.equal(s.lockedDate,"2026-10-16");assert.equal(s.dcrs[0].status,"SUBMITTED");
 assert.throws(()=>checkInVisit(s,"visit-doc-01"),/locked/);
});

test("manager metrics and approval queue are derived from underlying records",()=>{
 let s=buildScenario("MANAGER_QUEUE");const metrics=managerMetrics(s);const queue=approvalQueue(s);
 assert.equal(metrics.teamMembers,5);assert.ok(metrics.pendingTourPlans>0);assert.ok(metrics.pendingGpsExceptions>0);assert.ok(metrics.pendingDcrs>0);assert.ok(queue.length>=4);
 const first=queue[0];s=decideQueue(s,first,true);assert.ok(!approvalQueue(s).some(x=>x.kind===first.kind&&x.id===first.id));
});

test("FULL_FIELD_DAY contains doctor detailing and sample evidence with linked trade next",()=>{
 const s=buildScenario("FULL_FIELD_DAY");const v=activeVisit(s);
 assert.equal(v?.customerType,"DOCTOR");assert.ok(v?.clmSessionIds.length);assert.ok(v?.sampleDistributionIds.length);
 assert.ok(s.visits.some(x=>x.customerType==="CHEMIST"&&x.status==="PLANNED"));assert.ok(s.links.some(x=>x.type==="CHEMIST_STOCKIST"));
});
