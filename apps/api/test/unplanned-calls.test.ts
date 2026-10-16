import test from "node:test";
import assert from "node:assert/strict";
import {createUnplannedCallService,UnplannedInputError,UnplannedConflictError,type UnplannedRepository,type UnplannedCall} from "../../../modules/unplanned-calls/src/index.ts";
import type {RbacService} from "../../../modules/rbac/src/index.ts";
import type {MastersRepository} from "../../../modules/masters/src/index.ts";

const T="11111111-1111-4111-8111-111111111111",U="22222222-2222-4222-8222-222222222222";
const MANAGER="33333333-3333-4333-8333-333333333333",EX="44444444-4444-4444-8444-444444444444";
const TERR="55555555-5555-4555-8555-555555555555",CUSTOMER="66666666-6666-4666-8666-666666666666";
const OP="77777777-7777-4777-8777-777777777777";
const valid={operationId:OP,executionId:EX,territoryId:TERR,customerType:"doctor",customerId:CUSTOMER,
 reason:"Unexpected customer request",remarks:"Discussed clinical product availability",durationMinutes:30,
 latitude:17.38,longitude:78.48,accuracyMeters:12};
function fixture(opts:{deny?:boolean;otherTerritory?:boolean;inactive?:boolean}={}){
 let submitted=0,decisions=0;
 const row:UnplannedCall={id:OP,actorUserId:U,executionId:EX,workDate:"2026-10-11",territoryId:TERR,
 customerType:"doctor",customerId:CUSTOMER,reason:valid.reason,remarks:valid.remarks,durationMinutes:30,
 latitude:17.38,longitude:78.48,accuracyMeters:12,status:"SUBMITTED",managerComment:null,
 submittedAt:"2026-10-11T08:00:00Z",reviewedAt:null};
 const repo:UnplannedRepository={
  submit:async(_,__,cmd)=>{submitted++;assert.equal(cmd.operationId,OP);return OP;},
  own:async()=>[row],pending:async()=>[row],byId:async()=>row,
  decide:async(_,actor,id,decision,comment)=>{assert.equal(actor,MANAGER);assert.equal(id,OP);
    decisions++;row.status=decision==="APPROVE"?"APPROVED":"REJECTED";row.managerComment=comment;},
 };
 const rbac={authorize:async(_t:string,permission:string,scope:string|null)=>{
  if(opts.deny)throw new Error("Permission denied");
  assert.ok(["TOUR_PLAN_OWN","TOUR_APPROVE"].includes(permission));assert.equal(scope,TERR);
 }} as unknown as RbacService;
 const masters={get:async(kind:string,t:string,id:string)=>{
  assert.equal(kind,"doctors");assert.equal(t,T);assert.equal(id,CUSTOMER);
  return opts.inactive?null:{id:CUSTOMER,status:"active",territoryId:opts.otherTerritory?"88888888-8888-4888-8888-888888888888":TERR};
 }} as unknown as MastersRepository;
 return {service:createUnplannedCallService(repo,rbac,masters),counts:()=>({submitted,decisions}),row};
}
test("unplanned call binds active execution, customer, GPS and tenant to server repository",async()=>{
 const {service,counts}=fixture();
 const result=await service.submit(T,U,"bearer",valid);
 assert.equal(result.status,"SUBMITTED");assert.equal(counts().submitted,1);
});
test("unplanned submission rejects forged customer, inactive master or denied territory",async()=>{
 for(const opts of [{otherTerritory:true},{inactive:true},{deny:true}]){
  const {service,counts}=fixture(opts);
  await assert.rejects(service.submit(T,U,"bearer",valid));assert.equal(counts().submitted,0);
 }
});
test("unplanned submission rejects missing GPS, invalid IDs and noninteger duration",async()=>{
 const {service,counts}=fixture();
 for(const input of [
  {...valid,latitude:null},{...valid,accuracyMeters:1001},{...valid,durationMinutes:20.5},
  {...valid,executionId:"invalid"},{...valid,customerType:"NCA"},
  {...valid,reason:""},{...valid,remarks:""}]){
  await assert.rejects(service.submit(T,U,"bearer",input),UnplannedInputError);
 }
 assert.equal(counts().submitted,0);
});
test("only an authorized manager may review a different representative's submitted call",async()=>{
 const {service,counts,row}=fixture();
 await assert.rejects(service.decide(T,U,"bearer",OP,{decision:"APPROVE"}),UnplannedConflictError);
 assert.equal((await service.decide(T,MANAGER,"bearer",OP,{decision:"REJECT",comment:"Territory evidence incomplete"})).status,"REJECTED");
 await assert.rejects(service.decide(T,MANAGER,"bearer",OP,{decision:"APPROVE"}),UnplannedConflictError);
 assert.equal(counts().decisions,1);assert.equal(row.managerComment,"Territory evidence incomplete");
});
test("denied managers cannot review or see a pending team queue",async()=>{
 const {service,counts}=fixture({deny:true});
 assert.deepEqual(await service.pending(T,"bearer"),[]);
 await assert.rejects(service.decide(T,MANAGER,"bearer",OP,{decision:"APPROVE"}));
 assert.equal(counts().decisions,0);
});
test("reject decision requires a manager comment",async()=>{
 const {service,counts}=fixture();
 await assert.rejects(service.decide(T,MANAGER,"bearer",OP,{decision:"REJECT",comment:""}),UnplannedInputError);
 assert.equal(counts().decisions,0);
});
