import test from "node:test";
import assert from "node:assert/strict";
import { createSubmitTourService, SubmitTourInputError, SubmitTourConflictError } from "../../../modules/tour-submit/src/index.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const user="22222222-2222-4222-8222-222222222222";
const op="33333333-3333-4333-8333-333333333333";
const execution="44444444-4444-4444-8444-444444444444";

test("TRV-SUBMIT-007 rejects invalid operation id before repository write",async()=>{
  let writes=0;
  const service=createSubmitTourService({
    submit:async()=>{writes++;return execution},
    getSubmitted:async()=>null,
  });
  await assert.rejects(service.submit(tenant,user,"token",{operationId:"bad"}),SubmitTourInputError);
  assert.equal(writes,0);
});

test("TRV-SUBMIT-006 forwards short-day reason and confirms submission",async()=>{
  let received:any;
  const result={id:execution,status:"SUBMITTED" as const,startedAt:"a",submittedAt:"b",requiredMinutes:480,workedMinutes:420,shortDayReason:"Medical appointment"};
  const service=createSubmitTourService({
    submit:async(_t,_u,input)=>{received=input;return execution},
    getSubmitted:async()=>result,
  });
  assert.deepEqual(await service.submit(tenant,user,"token",{operationId:op,shortDayReason:" Medical appointment "}),result);
  assert.equal(received.shortDayReason,"Medical appointment");
});

test("TRV-SUBMIT-007 fails confirmation instead of inventing submitted state",async()=>{
  const service=createSubmitTourService({
    submit:async()=>execution,
    getSubmitted:async()=>null,
  });
  await assert.rejects(service.submit(tenant,user,"token",{operationId:op}),SubmitTourConflictError);
});
