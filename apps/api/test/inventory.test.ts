import test from "node:test";
import assert from "node:assert/strict";
import { createInventoryService, InventoryInputError } from "../../../modules/inventory/src/index.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const actor="22222222-2222-4222-8222-222222222222";
const employee="33333333-3333-4333-8333-333333333333";
const territory="44444444-4444-4444-8444-444444444444";
const item="55555555-5555-4555-8555-555555555555";
const visit="66666666-6666-4666-8666-666666666666";
const op="77777777-7777-4777-8777-777777777777";

function repo(){
  return {
    listBalances:async()=>[],
    issue:async()=>{},
    returnOwn:async()=>{},
    distribute:async()=>{},
    listVisitDistributions:async()=>[],
  };
}
function rbac(scopes:string[]=[]):any{
  return {authorize:async(_t:string,_p:string,s:string)=>scopes.push(s),accessContext:async()=>({roles:[],permissions:[],orgAssignments:[]}),assignRole:async()=>{}};
}

test("TRV-INV-002 issue authorizes against target employee scope",async()=>{
  const scopes:string[]=[];let issued=0;
  const masters:any={
    get:async(kind:string)=>kind==="employees"
      ?{id:employee,code:"E1",name:"MR",status:"active",orgUnitId:territory}
      :{id:item,code:"S1",name:"Sample",status:"active",divisionId:"d"},
  };
  const repository={...repo(),issue:async()=>{issued++}};
  const service=createInventoryService(repository,masters,rbac(scopes));
  await service.issue(tenant,actor,"token",{operationId:op,employeeId:employee,itemType:"sample",itemId:item,quantity:10});
  assert.deepEqual(scopes,[territory]);assert.equal(issued,1);
});

test("TRV-INV-006 rejects duplicate distribution item before write",async()=>{
  let writes=0;
  const service=createInventoryService({...repo(),distribute:async()=>{writes++}} as any,{} as any,rbac());
  await assert.rejects(service.distribute(tenant,actor,"token",visit,{
    operationId:op,
    items:[
      {itemType:"sample",itemId:item,quantity:1},
      {itemType:"sample",itemId:item,quantity:2},
    ],
  }),InventoryInputError);
  assert.equal(writes,0);
});

test("TRV-INV-006 canonicalizes and submits multi-item distribution",async()=>{
  let received:any[]=[];
  const gift="88888888-8888-4888-8888-888888888888";
  const service=createInventoryService({...repo(),distribute:async(_t:any,_u:any,_v:any,input:any)=>{received=input.items}} as any,{} as any,rbac());
  await service.distribute(tenant,actor,"token",visit,{
    operationId:op,
    items:[
      {itemType:"gift",itemId:gift,quantity:1},
      {itemType:"sample",itemId:item,quantity:2},
    ],
  });
  assert.equal(received.length,2);
  assert.equal(received[0].itemType,"gift");
  assert.equal(received[1].itemType,"sample");
});

test("TRV-INV-004 rejects zero return quantity before repository write",async()=>{
  let writes=0;
  const service=createInventoryService({...repo(),returnOwn:async()=>{writes++}} as any,{} as any,rbac());
  await assert.rejects(service.returnOwn(tenant,actor,{operationId:op,itemType:"gift",itemId:item,quantity:0}),InventoryInputError);
  assert.equal(writes,0);
});
