import assert from "node:assert/strict";
import test from "node:test";
import {authorizedCustomers,filterCustomers,visibleRelationships,visibleHistory} from "../src/features/customer360/model.ts";
const rows=authorizedCustomers({doctors:[{id:"d",code:"D",name:"Doctor One",status:"active",territoryName:"North"}],chemists:[{id:"c",code:"C",name:"Chemist One",status:"active",territoryName:"South"}]});
test("search, kind, territory, and empty are exact authorized filters",()=>{
 assert.equal(filterCustomers(rows,{query:"doctor",kind:"all",status:"",territory:""}).length,1);
 assert.equal(filterCustomers(rows,{query:"",kind:"chemist",status:"active",territory:"North"}).length,0);
 assert.deepEqual(authorizedCustomers({}),[]);
});
test("links require same tenant and authorized target",()=>{
 const links=[{id:"link-1",tenantId:"t",sourceKind:"doctor" as const,sourceId:"d",targetKind:"chemist" as const,targetId:"c",relationship:"linked"},{id:"link-2",tenantId:"other",sourceKind:"doctor" as const,sourceId:"d",targetKind:"chemist" as const,targetId:"c",relationship:"leaked"}];
 assert.equal(visibleRelationships("t",rows[0],rows,links).length,1);
 assert.equal(visibleRelationships("t",rows[0],rows.slice(0,1),links).length,0);
});
test("history includes only matching tenant, customer and kind",()=>{
 const events=[
  {tenantId:"t",customerKind:"doctor" as const,customerId:"d",id:"match",occurredAt:"2026-10-11",activityType:"CALL",summary:"authorized"},
  {tenantId:"t",customerKind:"doctor" as const,customerId:"other",id:"othercustomer",occurredAt:"2026-10-12",activityType:"CALL",summary:"other"},
  {tenantId:"t",customerKind:"chemist" as const,customerId:"d",id:"otherkind",occurredAt:"2026-10-13",activityType:"CALL",summary:"other"},
  {tenantId:"other",customerKind:"doctor" as const,customerId:"d",id:"othertenant",occurredAt:"2026-10-14",activityType:"CALL",summary:"other"},
 ];
 assert.deepEqual(visibleHistory("t",rows[0],events).map(x=>x.id),["match"]);
});

test("history sorts by absolute timestamps across UTC offsets",()=>{
 const events=[
  {tenantId:"t",customerKind:"doctor" as const,customerId:"d",id:"later",occurredAt:"2026-10-10T23:30:00-02:00",activityType:"CALL",summary:"later"},
  {tenantId:"t",customerKind:"doctor" as const,customerId:"d",id:"earlier",occurredAt:"2026-10-11T00:30:00Z",activityType:"CALL",summary:"earlier"},
 ];
 assert.deepEqual(visibleHistory("t",rows[0],events).map(x=>x.id),["later","earlier"]);
});
