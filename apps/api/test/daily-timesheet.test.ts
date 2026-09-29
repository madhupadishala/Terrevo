import test from "node:test";
import assert from "node:assert/strict";
import { createDailyTimesheetService, DailyTimesheetInputError, DailyTimesheetConflictError } from "../../../modules/timesheet-daily/src/index.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const user="22222222-2222-4222-8222-222222222222";
const sheet="33333333-3333-4333-8333-333333333333";
const op="44444444-4444-4444-8444-444444444444";

test("TRV-DTS-007 review validates operation UUID before write",async()=>{
  let writes=0;
  const service=createDailyTimesheetService({
    listOwn:async()=>[],getOwn:async()=>null,review:async()=>{writes++},
  });
  await assert.rejects(service.review(tenant,user,"token",sheet,{operationId:"bad"}),DailyTimesheetInputError);
  assert.equal(writes,0);
});

test("TRV-DTS-006 review confirms immutable generated record became REVIEWED",async()=>{
  const row={id:sheet,executionId:"e",workDate:"2026-09-29",startedAt:"a",submittedAt:"b",totalMinutes:480,visitMinutes:120,unclassifiedMinutes:360,callCount:4,status:"REVIEWED" as const,remarks:"Reviewed",reviewedAt:"c"};
  let received:any;
  const service=createDailyTimesheetService({
    listOwn:async()=>[],
    getOwn:async()=>row,
    review:async(_t,_u,_id,input)=>{received=input},
  });
  assert.deepEqual(await service.review(tenant,user,"token",sheet,{operationId:op,remarks:" Reviewed "}),row);
  assert.equal(received.remarks,"Reviewed");
});

test("TRV-DTS-006 confirmation failure is explicit",async()=>{
  const service=createDailyTimesheetService({
    listOwn:async()=>[],getOwn:async()=>null,review:async()=>{},
  });
  await assert.rejects(service.review(tenant,user,"token",sheet,{operationId:op}),DailyTimesheetConflictError);
});
