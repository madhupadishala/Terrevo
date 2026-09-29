import test from "node:test";
import assert from "node:assert/strict";
import { createVisitService, VisitInputError, VisitNotFoundError } from "../../../modules/visit-execution/src/index.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const user="22222222-2222-4222-8222-222222222222";
const visitId="33333333-3333-4333-8333-333333333333";
const stopId="44444444-4444-4444-8444-444444444444";
const op="55555555-5555-4555-8555-555555555555";
const territory="66666666-6666-4666-8666-666666666666";

function rbac(scopes:string[]=[]):any{return{authorize:async(_t:string,_p:string,s:string)=>scopes.push(s),accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}}}

test("TRV-VIS-002 only accepts supported geofence radii",async()=>{
 const service=createVisitService({} as any,rbac());
 await assert.rejects(service.updateSettings(tenant,"token",{geofenceRadiusMeters:75,maxGpsAccuracyMeters:50}),VisitInputError);
});

test("TRV-VIS-001 check-in confirms created visit",async()=>{
 const visit={id:visitId,executionId:"e",planStopId:stopId,territoryId:territory,status:"CHECKED_IN" as const,verification:"VERIFIED" as const,exceptionStatus:"NOT_REQUIRED" as const,distanceMeters:20,geofenceRadiusMeters:100,checkinAt:"x",checkoutAt:null};
 let writes=0;
 const service=createVisitService({
  getSettings:async()=>({geofenceRadiusMeters:100,maxGpsAccuracyMeters:50}),updateSettings:async()=>{},
  checkIn:async()=>{writes++;return visitId},getOpen:async()=>visit,getById:async()=>visit,
  checkOut:async()=>{},recordDeparture:async()=>visitId,getPresence:async()=>null,listPendingExceptions:async()=>[],decideException:async()=>{},
 },rbac());
 const result=await service.checkIn(tenant,user,"token",{operationId:op,planStopId:stopId,latitude:17,longitude:78,accuracyMeters:15});
 assert.equal(result.id,visitId);assert.equal(writes,1);
});

test("TRV-VIS-008 GPS exception review requires pending visible visit",async()=>{
 const service=createVisitService({
  getSettings:async()=>({geofenceRadiusMeters:100,maxGpsAccuracyMeters:50}),updateSettings:async()=>{},
  checkIn:async()=>visitId,getOpen:async()=>null,getById:async()=>null,checkOut:async()=>{},
  recordDeparture:async()=>visitId,getPresence:async()=>null,listPendingExceptions:async()=>[],decideException:async()=>{},
 },rbac());
 await assert.rejects(service.decideException(tenant,user,"token",visitId,{decision:"APPROVE"}),VisitNotFoundError);
});


test("TRV-PRES-010 records 3+ departure samples and confirms server result",async()=>{
 const closed={id:visitId,executionId:"e",planStopId:stopId,territoryId:territory,status:"CHECKED_OUT" as const,verification:"VERIFIED" as const,exceptionStatus:"NOT_REQUIRED" as const,distanceMeters:20,geofenceRadiusMeters:100,checkinAt:"x",checkoutAt:"2026-09-29T11:00:00Z"};
 const presence={
  id:"77777777-7777-4777-8777-777777777777",visitId,executionId:"e",status:"CONSISTENT" as const,
  sampleCount:3,totalDistanceMeters:42,maxSegmentSpeedKph:18,mockedDetected:false,
  reason:"consistent",deviceId:"device",serverDelaySeconds:120,recordedAt:"2026-09-29T11:02:00Z",
  samples:[],
 };
 let recorded:any=null;
 const service=createVisitService({
  getSettings:async()=>({geofenceRadiusMeters:100,maxGpsAccuracyMeters:50}),updateSettings:async()=>{},
  checkIn:async()=>visitId,getOpen:async()=>null,getById:async()=>closed,checkOut:async()=>{},
  recordDeparture:async(_t,_u,_v,input)=>{recorded=input;return presence.id},
  getPresence:async()=>presence,listPendingExceptions:async()=>[],decideException:async()=>{},
 },rbac());
 const result=await service.recordDeparture(tenant,user,"token",visitId,{
  operationId:op,
  samples:[
   {capturedAt:"2026-09-29T11:00:20Z",latitude:17,longitude:78,accuracyMeters:8,mocked:false},
   {capturedAt:"2026-09-29T11:00:50Z",latitude:17.0001,longitude:78.0001,accuracyMeters:9,mocked:false},
   {capturedAt:"2026-09-29T11:01:20Z",latitude:17.0002,longitude:78.0002,accuracyMeters:10,mocked:false},
  ],
 });
 assert.equal(result.status,"CONSISTENT");
 assert.equal(recorded.samples.length,3);
});

test("TRV-PRES-010 rejects too few departure samples",async()=>{
 const closed={id:visitId,executionId:"e",planStopId:stopId,territoryId:territory,status:"CHECKED_OUT" as const,verification:"VERIFIED" as const,exceptionStatus:"NOT_REQUIRED" as const,distanceMeters:20,geofenceRadiusMeters:100,checkinAt:"x",checkoutAt:"2026-09-29T11:00:00Z"};
 const service=createVisitService({
  getSettings:async()=>({geofenceRadiusMeters:100,maxGpsAccuracyMeters:50}),updateSettings:async()=>{},
  checkIn:async()=>visitId,getOpen:async()=>null,getById:async()=>closed,checkOut:async()=>{},
  recordDeparture:async()=>visitId,getPresence:async()=>null,listPendingExceptions:async()=>[],decideException:async()=>{},
 },rbac());
 await assert.rejects(service.recordDeparture(tenant,user,"token",visitId,{
  operationId:op,
  samples:[
   {capturedAt:"2026-09-29T11:00:20Z",latitude:17,longitude:78,accuracyMeters:8,mocked:false},
   {capturedAt:"2026-09-29T11:00:50Z",latitude:17.0001,longitude:78.0001,accuracyMeters:9,mocked:false},
  ],
 }),VisitInputError);
});
