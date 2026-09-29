import test from "node:test";
import assert from "node:assert/strict";
import { createWeeklyTimesheetService, WeeklyTimesheetInputError, WeeklyTimesheetConflictError } from "../../../modules/timesheet-weekly/src/index.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const user="22222222-2222-4222-8222-222222222222";
const id="33333333-3333-4333-8333-333333333333";
const org="44444444-4444-4444-8444-444444444444";
const op="55555555-5555-4555-8555-555555555555";
const row={id,employeeId:"e",orgUnitId:org,weekStart:"2026-09-28",status:"SUBMITTED" as const,dailyCount:5,totalMinutes:2400,visitMinutes:600,unclassifiedMinutes:1800,callCount:20,submissionComment:null,submittedAt:"x",reviewComment:null,reviewedAt:null};

function rbac(scopes:string[]=[]):any{return{authorize:async(_t:string,_p:string,s:string)=>scopes.push(s),accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}}}

test("TRV-TXF-009 owner weekly read forwards authenticated user scope",async()=>{
  let received:string[]=[];
  const service=createWeeklyTimesheetService({
    listVisible:async()=>[],listOwn:async(t,u,token)=>{received=[t,u,token];return[row]},listPending:async()=>[],
    getVisible:async()=>row,generate:async()=>id,submit:async()=>{},decide:async()=>{},
  },rbac());
  assert.deepEqual(await service.listOwn(tenant,user,"token"),[row]);
  assert.deepEqual(received,[tenant,user,"token"]);
});

test("TRV-WTS-001 requires Monday week start",async()=>{
  const service=createWeeklyTimesheetService({} as any,rbac());
  await assert.rejects(service.generate(tenant,user,"token",{weekStart:"2026-09-29"}),WeeklyTimesheetInputError);
});

test("TRV-WTS-004 submit confirms SUBMITTED state",async()=>{
  let received:any;
  const service=createWeeklyTimesheetService({
    listVisible:async()=>[],listOwn:async()=>[],listPending:async()=>[],getVisible:async()=>row,generate:async()=>id,
    submit:async(_t,_u,_id,input)=>{received=input},decide:async()=>{},
  },rbac());
  assert.deepEqual(await service.submit(tenant,user,"token",id,{operationId:op}),row);
  assert.equal(received.operationId,op);
});

test("TRV-WTS-005 manager decision checks employee scope",async()=>{
  const scopes:string[]=[];let decided=0;
  const service=createWeeklyTimesheetService({
    listVisible:async()=>[],listOwn:async()=>[],listPending:async()=>[],getVisible:async()=>row,generate:async()=>id,
    submit:async()=>{},decide:async()=>{decided++},
  },rbac(scopes));
  await service.decide(tenant,user,"token",id,{decision:"APPROVE"});
  assert.deepEqual(scopes,[org]);assert.equal(decided,1);
});

test("TRV-WTS-007 RETURN requires comment",async()=>{
  const service=createWeeklyTimesheetService({
    listVisible:async()=>[],listOwn:async()=>[],listPending:async()=>[],getVisible:async()=>row,generate:async()=>id,
    submit:async()=>{},decide:async()=>{},
  },rbac());
  await assert.rejects(service.decide(tenant,user,"token",id,{decision:"RETURN"}),WeeklyTimesheetInputError);
});
