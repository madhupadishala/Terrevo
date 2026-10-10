import assert from "node:assert/strict";
import test from "node:test";
import {buildTodaySummary,visibleSuggestions} from "../src/features/intelligence/model.ts";
const stop={planStopId:"s",sequence:1,type:"doctor" as const,targetId:"d",targetName:"Doctor",status:"PENDING" as const};
const progress={executionId:"e",workDate:"2026-10-10",territoryId:"t",startedAt:"2026-10-10",serverNow:"2026-10-10",requiredMinutes:120,elapsedMinutes:30,remainingMinutes:90,plannedCount:1,completedCount:0,inProgressCount:0,pendingCount:1,stops:[stop]};
test("no invented action or stale execution in today counts",()=>{
 const x=buildTodaySummary("2026-10-11",progress,[],null);
 assert.equal(x.hasVerifiedTour,false);assert.equal(x.planned,0);assert.equal(x.nextStops.length,0);
 assert.deepEqual(buildTodaySummary("2026-10-11",null,[],null).startOptions,[]);
});
test("real same-date pending statuses and manager queues",()=>{
 const x=buildTodaySummary("2026-10-10",progress,[],{localDate:"2026-10-10",teamMembers:1,activeTours:1,submittedToursToday:0,shortDaysToday:0,activeJointWork:0,pending:{tourApprovals:3,gpsExceptions:0,weeklyTimesheets:0,leaves:0,expenses:0}});
 assert.equal(x.pending,1);assert.equal(x.nextStops[0].targetName,"Doctor");assert.equal(x.managerPending[0].count,3);
});
test("AI suggestions absent unless sourced and tenant scoped",()=>{
 assert.deepEqual(visibleSuggestions("t"),[]);
 const x={id:"x",tenantId:"t",summary:"Review verified item",reason:"Explicit source",actionType:"REVIEW",sourceType:"case",sourceId:"123",sourceObservedAt:"2026-10-10",confidence:null,uncertainty:"Needs review",requiresHumanReview:true as const,evidence:[{label:"Record",reference:"123"}]};
 assert.equal(visibleSuggestions("t",[x]).length,1);
 assert.deepEqual(visibleSuggestions("other",[x]),[]);
 assert.deepEqual(visibleSuggestions("t",[{...x,evidence:[]}]),[]);
});
