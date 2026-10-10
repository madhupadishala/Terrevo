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
 const links=[{tenantId:"t",sourceKind:"doctor" as const,sourceId:"d",targetKind:"chemist" as const,targetId:"c",relationship:"linked"},{tenantId:"other",sourceKind:"doctor" as const,sourceId:"d",targetKind:"chemist" as const,targetId:"c",relationship:"leaked"}];
 assert.equal(visibleRelationships("t",rows[0],rows,links).length,1);
 assert.equal(visibleRelationships("t",rows[0],rows.slice(0,1),links).length,0);
});
test("history is explicit and scoped",()=>{
 assert.deepEqual(visibleHistory("t",rows[0],[{tenantId:"other",customerKind:"doctor",customerId:"d",id:"x",occurredAt:"2026",activityType:"CALL",summary:"hidden"}]),[]);
});
