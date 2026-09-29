import test from "node:test";
import assert from "node:assert/strict";
import { createTradeCallService, TradeCallInputError, TradeCallNotFoundError } from "../../../modules/trade-call/src/index.ts";

const t="11111111-1111-4111-8111-111111111111",u="22222222-2222-4222-8222-222222222222",v="33333333-3333-4333-8333-333333333333",o="44444444-4444-4444-8444-444444444444";

test("TRV-TRADE-002 outcome is required",async()=>{
 let writes=0;const service=createTradeCallService({save:async()=>{writes++;return"x"},getByVisit:async()=>null});
 await assert.rejects(service.save(t,u,"token",v,{operationId:o}),TradeCallInputError);assert.equal(writes,0);
});
test("TRV-TRADE-004 saves and confirms call",async()=>{
 const row={id:"c",visitId:v,callType:"chemist" as const,outcome:"Order discussion",remarks:null,nextAction:null,updatedAt:"x"};
 const service=createTradeCallService({save:async()=>"c",getByVisit:async()=>row});
 assert.deepEqual(await service.save(t,u,"token",v,{operationId:o,outcome:"Order discussion"}),row);
});
test("TRV-TRADE-007 missing call is explicit",async()=>{
 const service=createTradeCallService({save:async()=>"c",getByVisit:async()=>null});
 await assert.rejects(service.get(t,"token",v),TradeCallNotFoundError);
});
