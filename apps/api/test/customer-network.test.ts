import test from"node:test";import assert from"node:assert/strict";
import{createCustomerNetworkService,CustomerNetworkInputError,CustomerNetworkNotFoundError}from"../../../modules/customer-network/src/index.ts";

const t="11111111-1111-4111-8111-111111111111",u="22222222-2222-4222-8222-222222222222";
const doctor="33333333-3333-4333-8333-333333333333",chemist="44444444-4444-4444-8444-444444444444",stockist="55555555-5555-4555-8555-555555555555";
const mk=(kind:string,id:string)=>({id,code:kind.toUpperCase(),name:kind,status:"active" as const,territoryId:"66666666-6666-4666-8666-666666666666"});

test("customer network only allows Doctor to Chemist and Chemist to Stockist",async()=>{
 let writes=0;
 const rows:any[]=[];
 const service=createCustomerNetworkService({
   listRelationships:async()=>rows,
   link:async()=>{writes++;return"77777777-7777-4777-8777-777777777777"},
   unlink:async()=>{},
   history:async()=>[],
 },{
   list:async()=>[],create:async()=>{throw new Error("unused")},
   get:async(kind,_t,id)=>mk(kind,id),
 });
 await assert.rejects(service.link(t,u,"token",{sourceKind:"doctor",sourceId:doctor,targetKind:"stockist",targetId:stockist}),CustomerNetworkInputError);
 assert.equal(writes,0);
});

test("customer network refuses links to inaccessible customers before privileged RPC write",async()=>{
 let writes=0;
 const service=createCustomerNetworkService({
   listRelationships:async()=>[],
   link:async()=>{writes++;return"77777777-7777-4777-8777-777777777777"},
   unlink:async()=>{},
   history:async()=>[],
 },{
   list:async()=>[],create:async()=>{throw new Error("unused")},
   get:async(kind,_t,id)=>kind==="doctors"&&id===doctor?mk(kind,id):null,
 });
 await assert.rejects(service.link(t,u,"token",{sourceKind:"doctor",sourceId:doctor,targetKind:"chemist",targetId:chemist}),CustomerNetworkNotFoundError);
 assert.equal(writes,0);
});

test("customer network confirms a persisted authorized relationship",async()=>{
 const id="77777777-7777-4777-8777-777777777777";
 const rows:any[]=[];
 const service=createCustomerNetworkService({
   listRelationships:async()=>rows,
   link:async(_t,_u,sourceKind,sourceId,targetKind,targetId)=>{
     rows.push({id,tenantId:t,sourceKind,sourceId,targetKind,targetId,relationship:"DOCTOR_CHEMIST",createdAt:"2026-10-15T00:00:00Z"});return id;
   },
   unlink:async()=>{},
   history:async()=>[],
 },{
   list:async()=>[],create:async()=>{throw new Error("unused")},
   get:async(kind,_t,id)=>mk(kind,id),
 });
 const row=await service.link(t,u,"token",{sourceKind:"doctor",sourceId:doctor,targetKind:"chemist",targetId:chemist});
 assert.equal(row.id,id);assert.equal(row.relationship,"DOCTOR_CHEMIST");
});
