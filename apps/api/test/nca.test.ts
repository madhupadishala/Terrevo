import test from "node:test";
import assert from "node:assert/strict";
import {createNcaService,NcaInputError,NcaConflictError,type NcaRepository,type NcaRecord} from "../../../modules/nca/src/index.ts";
import type {RbacService} from "../../../modules/rbac/src/index.ts";

const T="11111111-1111-4111-8111-111111111111",U="22222222-2222-4222-8222-222222222222";
const TERR="33333333-3333-4333-8333-333333333333",TOWN="44444444-4444-4444-8444-444444444444",OP="55555555-5555-4555-8555-555555555555";
function fixture(denied=false) {
 let created=0,submitted=0,configured=0;
 const nca:NcaRecord={id:OP,workDate:"2026-10-11",territoryId:TERR,phase:"PLAN",categoryCode:"TEAM_MEETING",
  townId:TOWN,reason:"Review team objectives",remarks:"Agenda reviewed",durationMinutes:45,status:"DRAFT",createdAt:"2026-10-11T10:00:00Z"};
 const repo:NcaRepository={
  options:async()=>({categories:[{code:"TEAM_MEETING",label:"Team meeting",active:true}],towns:[{id:TOWN,name:"Approved town",territoryId:TERR,active:true}]}),
  listOwn:async()=>[nca],getOwn:async()=>nca,
  create:async(_t,_u,input)=>{created++;assert.equal(input.operationId,OP);assert.equal(input.categoryCode,"TEAM_MEETING");return OP;},
  submit:async()=>{submitted++;nca.status="SUBMITTED";},
  createCategory:async()=>{configured++;},createTown:async()=>{configured++;},
 };
 const rbac={authorize:async(_t:string,permission:string,scope:string|null)=>{
  if(denied)throw new Error("Permission denied");
  if(permission==="TOUR_PLAN_OWN")assert.equal(scope,TERR);
 }} as unknown as RbacService;
 return {service:createNcaService(repo,rbac),counts:()=>({created,submitted,configured}),record:nca};
}
const valid={operationId:OP,workDate:"2026-10-11",territoryId:TERR,phase:"PLAN",categoryCode:"TEAM_MEETING",townId:TOWN,
 reason:"Review team objectives",remarks:"Agenda reviewed",durationMinutes:45};
test("valid NCA PLAN saves one server draft under the authorized territory",async()=>{
 const {service,counts}=fixture();
 const row=await service.save(T,U,"bearer",valid);
 assert.equal(row.id,OP);assert.equal(row.status,"DRAFT");assert.equal(counts().created,1);
});
test("REPORT permits omitted town; PLAN does not",async()=>{
 const {service,counts}=fixture();
 await service.save(T,U,"bearer",{...valid,phase:"REPORT",townId:null});
 await assert.rejects(service.save(T,U,"bearer",{...valid,townId:null}),NcaInputError);
 assert.equal(counts().created,1);
});
test("NCA rejects invalid dates, unapproved categories, zero duration and incorrect territory",async()=>{
 const {service,counts}=fixture();
 for(const input of [{...valid,workDate:"2026-02-30"},{...valid,categoryCode:"NOT_CONTROLLED"},
   {...valid,durationMinutes:0},{...valid,territoryId:"66666666-6666-4666-8666-666666666666"},
   {...valid,townId:"77777777-7777-4777-8777-777777777777"}]) {
  await assert.rejects(service.save(T,U,"bearer",input));
 }
 assert.equal(counts().created,0);
});
test("NCA mutation is denied before repository write for unauthorized scope",async()=>{
 const {service,counts}=fixture(true);
 await assert.rejects(service.save(T,U,"bearer",valid));
 assert.equal(counts().created,0);
});
test("submissions can occur once and cannot silently overwrite submitted records",async()=>{
 const {service,counts}=fixture();
 assert.equal((await service.submit(T,U,"bearer",OP)).status,"SUBMITTED");
 await assert.rejects(service.submit(T,U,"bearer",OP),NcaConflictError);
 assert.equal(counts().submitted,1);
});
test("NCA configuration requires MASTER_MANAGE and does not seed an unverified taxonomy",async()=>{
 const {service,counts}=fixture();
 await service.configureCategory(T,U,"bearer",{code:"TEAM_MEETING",label:"Team meeting"});
 await service.configureTown(T,U,"bearer",{territoryId:TERR,name:"Approved town"});
 assert.equal(counts().configured,2);
 await assert.rejects(service.configureCategory(T,U,"bearer",{code:"foo",label:"Unsafe"}),NcaInputError);
 const denied=fixture(true);
 await assert.rejects(denied.service.configureCategory(T,U,"bearer",{code:"TEAM_MEETING",label:"X"}));
 assert.equal(denied.counts().configured,0);
});
