import test from "node:test";
import assert from "node:assert/strict";
import { createTourExecutionService, TourExecutionInputError, TourExecutionNotFoundError, TourExecutionConflictError } from "../../../modules/tour-execution/src/index.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const user="22222222-2222-4222-8222-222222222222";
const day="33333333-3333-4333-8333-333333333333";
const territory="44444444-4444-4444-8444-444444444444";
const operation="55555555-5555-4555-8555-555555555555";

function rbac(checked:string[]=[]):any {
  return {authorize:async(_t:string,_p:string,scope:string)=>checked.push(scope),accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}};
}

test("TRV-EXEC-006 rejects invalid GPS evidence before repository calls",async()=>{
  let calls=0;
  const service=createTourExecutionService({
    listStartOptions:async()=>{calls++;return[]},getActive:async()=>null,start:async()=>operation,
  },rbac());
  await assert.rejects(service.start(tenant,user,"token",{
    operationId:operation,planDayId:day,latitude:91,longitude:78,accuracyMeters:10,
  }),TourExecutionInputError);
  assert.equal(calls,0);
});

test("TRV-EXEC-001 refuses unapproved/unavailable day before privileged start",async()=>{
  let writes=0;
  const service=createTourExecutionService({
    listStartOptions:async()=>[],getActive:async()=>null,start:async()=>{writes++;return operation},
  },rbac());
  await assert.rejects(service.start(tenant,user,"token",{
    operationId:operation,planDayId:day,latitude:17,longitude:78,accuracyMeters:20,
  }),TourExecutionNotFoundError);
  assert.equal(writes,0);
});

test("TRV-EXEC-001 authorizes territory and confirms started execution",async()=>{
  const checked:string[]=[]; let writes=0;
  const active={
    id:operation,operationId:operation,planId:"66666666-6666-4666-8666-666666666666",
    planDayId:day,workDate:"2026-09-29",territoryId:territory,status:"ACTIVE" as const,
    startedAt:"2026-09-29T01:00:00Z",deviceStartedAt:null,requiredMinutes:480,
    startLatitude:17,startLongitude:78,startAccuracyMeters:20,deviceId:null,networkType:null,appVersion:null,
  };
  const service=createTourExecutionService({
    listStartOptions:async()=>[{planId:active.planId,planDayId:day,workDate:active.workDate,territoryId:territory}],
    getActive:async()=>writes?active:null,
    start:async()=>{writes++;return operation},
  },rbac(checked));
  const result=await service.start(tenant,user,"token",{
    operationId:operation,planDayId:day,latitude:17,longitude:78,accuracyMeters:20,
  });
  assert.equal(result.id,operation);
  assert.deepEqual(checked,[territory]);
  assert.equal(writes,1);
});
test("TRV-EXEC-004 recovers lost start responses after options disappear and rejects changed retries",async()=>{
  let writes=0,optionReads=0;const checked:string[]=[];
  const active={id:operation,operationId:operation,planId:user,planDayId:day,workDate:"2026-10-11",
    territoryId:territory,status:"ACTIVE" as const,startedAt:"2026-10-11T01:00:00Z",deviceStartedAt:null,
    requiredMinutes:480,startLatitude:17,startLongitude:78,startAccuracyMeters:20,
    deviceId:null,networkType:null,appVersion:null};
  const service=createTourExecutionService({
    listStartOptions:async()=>{optionReads++;return writes?[]:[{planId:user,planDayId:day,workDate:active.workDate,territoryId:territory}]},
    getActive:async()=>writes?active:null,start:async()=>{writes++;return operation},
  },rbac(checked));
  const input={operationId:operation,planDayId:day,latitude:17,longitude:78,accuracyMeters:20};
  assert.equal((await service.start(tenant,user,"token",input)).id,operation);
  assert.equal((await service.start(tenant,user,"token",input)).id,operation);
  assert.equal(writes,1);assert.equal(optionReads,1);
  for(const change of [{planDayId:user},{latitude:18},{longitude:79},{accuracyMeters:30},
    {deviceId:"other"},{networkType:"wifi"},{appVersion:"new"},{deviceStartedAt:"2026-10-11T02:00:00Z"}])
    await assert.rejects(service.start(tenant,user,"token",{...input,...change}),TourExecutionConflictError);
  assert.equal(writes,1);
  assert.ok(checked.every(scope=>scope===territory));
});
test("TRV-EXEC-004 replay rechecks current territory permission",async()=>{
  let writes=0;
  const service=createTourExecutionService({
    listStartOptions:async()=>[],getActive:async()=>({operationId:operation,territoryId:territory} as never),
    start:async()=>{writes++;return operation},
  },{...rbac(),authorize:async()=>{throw new Error("Permission revoked")}});
  await assert.rejects(service.start(tenant,user,"token",{
    operationId:operation,planDayId:day,latitude:17,longitude:78,accuracyMeters:20,
  }),/Permission revoked/);
  assert.equal(writes,0);
});

test("TRV-EXEC-004 treats equivalent timestamp offsets as the same retry evidence",async()=>{
  const service=createTourExecutionService({listStartOptions:async()=>{throw Error("must use persisted start")},
    getActive:async()=>({id:operation,operationId:operation,planDayId:day,territoryId:territory,
      deviceStartedAt:"2026-10-11T07:00:00+00:00",startLatitude:17,startLongitude:78,startAccuracyMeters:20,
      deviceId:null,networkType:null,appVersion:null} as never),start:async()=>{throw Error("must not write")}},rbac());
  assert.equal((await service.start(tenant,user,"token",{operationId:operation,planDayId:day,
    deviceStartedAt:"2026-10-11T12:30:00+05:30",latitude:17,longitude:78,accuracyMeters:20})).id,operation);
});
