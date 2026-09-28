import test from "node:test";
import assert from "node:assert/strict";
import { createTourApprovalService, TourApprovalInputError } from "../../../modules/tour-approval/src/index.ts";

const territoryA="11111111-1111-4111-8111-111111111111";
const territoryB="22222222-2222-4222-8222-222222222222";
const planId="33333333-3333-4333-8333-333333333333";
const tenantId="44444444-4444-4444-8444-444444444444";
const actorId="55555555-5555-4555-8555-555555555555";

function submitted(){
  return {
    id:planId,weekStart:"2026-10-05",status:"SUBMITTED" as const,submittedAt:"2026-10-01T00:00:00Z",
    days:[
      {date:"2026-10-05",territoryId:territoryA,remarks:null,stops:[]},
      {date:"2026-10-06",territoryId:territoryB,remarks:null,stops:[]},
    ],
  };
}

test("TRV-APR-003 reject requires comment before write", async()=>{
  let writes=0;
  const service=createTourApprovalService({
    listPending:async()=>[],
    getForReview:async()=>submitted(),
    decide:async()=>{writes++},
  }, {authorize:async()=>{},accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}} as any);

  await assert.rejects(
    service.decide(tenantId,actorId,planId,"token",{decision:"REJECT"}),
    TourApprovalInputError,
  );
  assert.equal(writes,0);
});

test("TRV-APR-001/002 approval checks every unique territory before write", async()=>{
  const checked:string[]=[]; const writes:any[]=[];
  const service=createTourApprovalService({
    listPending:async()=>[],
    getForReview:async()=>submitted(),
    decide:async(...args)=>{writes.push(args)},
  }, {authorize:async(_t:any,_p:any,scope:any)=>{checked.push(scope)},accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}} as any);

  await service.decide(tenantId,actorId,planId,"token",{decision:"APPROVE"});
  assert.deepEqual(checked,[territoryA,territoryB]);
  assert.equal(writes.length,1);
  assert.equal(writes[0][3],"APPROVE");
});

test("TRV-APR-004 return preserves a required manager comment", async()=>{
  let comment:string|null=null;
  const service=createTourApprovalService({
    listPending:async()=>[],
    getForReview:async()=>submitted(),
    decide:async(_t,_a,_p,_d,c)=>{comment=c},
  }, {authorize:async()=>{},accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}} as any);

  await service.decide(tenantId,actorId,planId,"token",{decision:"RETURN",comment:"Move doctor to Tuesday"});
  assert.equal(comment,"Move doctor to Tuesday");
});
