import test from "node:test";
import assert from "node:assert/strict";
import { createDoctorCallService, DoctorCallInputError, DoctorCallNotFoundError } from "../../../modules/doctor-call/src/index.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const user="22222222-2222-4222-8222-222222222222";
const visit="33333333-3333-4333-8333-333333333333";
const op="44444444-4444-4444-8444-444444444444";
const product="55555555-5555-4555-8555-555555555555";

test("TRV-DCR-003 rejects duplicate detailed product before repository write",async()=>{
  let writes=0;
  const service=createDoctorCallService({
    save:async()=>{writes++;return"c"},getByVisit:async()=>null,listDcrs:async()=>[],getDcr:async()=>null,
  });
  await assert.rejects(service.save(tenant,user,"token",visit,{
    operationId:op,callOutcome:"Detailed",
    products:[
      {sequence:1,productId:product},
      {sequence:2,productId:product},
    ],
  }),DoctorCallInputError);
  assert.equal(writes,0);
});

test("TRV-DCR-005 saves validated call and confirms it",async()=>{
  const call={
    id:"call",visitId:visit,doctorId:"doctor",callOutcome:"Detailed",remarks:null,nextAction:"Follow up",
    products:[{sequence:1,productId:product,detailNotes:"Efficacy"}],updatedAt:"now",
  };
  let writes=0;
  const service=createDoctorCallService({
    save:async()=>{writes++;return"call"},getByVisit:async()=>call,listDcrs:async()=>[],getDcr:async()=>null,
  });
  const result=await service.save(tenant,user,"token",visit,{
    operationId:op,callOutcome:"Detailed",nextAction:"Follow up",
    products:[{sequence:1,productId:product,detailNotes:"Efficacy"}],
  });
  assert.equal(result.id,"call");assert.equal(writes,1);
});

test("TRV-DCR-010 returns not found rather than inventing a DCR",async()=>{
  const service=createDoctorCallService({
    save:async()=>"call",getByVisit:async()=>null,listDcrs:async()=>[],getDcr:async()=>null,
  });
  await assert.rejects(
    service.getDcr(tenant,"token","66666666-6666-4666-8666-666666666666"),
    DoctorCallNotFoundError,
  );
});
