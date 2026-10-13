import assert from "node:assert/strict";
import test from "node:test";
import {authorizedCustomerRefs,patientSafeHistory,relationshipEvidenceWithTargets,workforceEvidenceModels} from "../src/v32-feature-adapters.ts";

test("authorized customer refs include only active records with territory scope",()=>{
 const refs=authorizedCustomerRefs("t1",{doctors:[
  {id:"d1",name:"Doctor One",code:"D1",status:"active",territoryId:"terr1"},
  {id:"d2",name:"Inactive",code:"D2",status:"inactive",territoryId:"terr1"},
 ] as any,chemists:[{id:"c1",name:"Chemist",code:"C1",status:"active",territoryId:"terr1"}] as any});
 assert.deepEqual(refs.map(x=>x.id),["d1","c1"]);assert.ok(refs.every(x=>x.tenantId==="t1"));
});

test("relationship evidence resolves target kind from authorized masters and rejects ambiguity/cross tenant",()=>{
 const customers=[
  {tenantId:"t1",kind:"doctor" as const,id:"d1",name:"D",territoryId:"r1"},
  {tenantId:"t1",kind:"chemist" as const,id:"c1",name:"C",territoryId:"r1"},
 ];
 const source=customers[0];
 const rows=relationshipEvidenceWithTargets("t1",source,customers,[
  {id:"l1",tenantId:"t1",sourceId:"d1",targetId:"c1",territoryId:"r1",relation:"SERVES",approval:"APPROVED",evidenceId:"ev1",verifiedAt:"2026-10-13T00:00:00Z"},
  {id:"x",tenantId:"t2",sourceId:"d1",targetId:"c1",territoryId:"r1",relation:"BAD",approval:"APPROVED",evidenceId:"ev2",verifiedAt:"2026-10-13T00:00:00Z"},
 ] as any);
 assert.equal(rows.length,1);assert.equal(rows[0].target.kind,"chemist");assert.equal(rows[0].evidenceId,"ev1");
 const ambiguous=relationshipEvidenceWithTargets("t1",source,[...customers,{tenantId:"t1",kind:"stockist",id:"c1",name:"S",territoryId:"r1"}],rows as any);
 assert.equal(ambiguous.length,0);
});

test("history is marked patient-safe only from server-scoped rows and preserves provenance",()=>{
 const rows=patientSafeHistory("t1","r1",[{tenantId:"t1",customerKind:"doctor",customerId:"d1",id:"v1",occurredAt:"2026-10-13T01:00:00Z",activityType:"Doctor call",summary:"Completed"}]);
 assert.equal(rows.length,1);assert.equal(rows[0].patientSafe,true);assert.equal(rows[0].provenanceId,"v1");assert.equal(rows[0].territoryId,"r1");
});

test("workforce adapter derives tenant from authenticated context and converts major amounts to minor units",()=>{
 const model=workforceEvidenceModels("t1",{
  asOf:"2026-10-13T01:00:00Z",
  claims:[{id:"claim1",executionId:"exec",employeeId:"e1",ownerUserId:"u1",orgUnitId:"r1",workDate:"2026-10-13",currencyCode:"INR",status:"SUBMITTED",totalAmount:123.45,lines:[{sequence:1,category:"TRAVEL",amount:123.45,remarks:null,receiptReference:"doc-1"}]}],
  receipts:[{id:"receipt1",tenantId:"t1",claimId:"claim1",lineId:"claim1:1",status:"VERIFIED",documentRef:"doc-1"}],
  travel:[{tenantId:"t1",ownerUserId:"u1",workDate:"2026-10-13",sourceId:"gps1",distanceMeters:1250,method:"SERVER_GPS"}],
  attendance:[{id:"a1",tenantId:"t1",ownerUserId:"u1",workDate:"2026-10-13",state:"PRESENT",dayClosed:true,sourceId:"ts1",asOf:"2026-10-13T01:00:00Z"}],
  policies:[{tenantId:"t1",category:"TRAVEL",maxMinor:20000,currency:"INR",effectiveFrom:"2026-01-01",expiresAt:"2026-12-31",policyId:"p1"}],
 });
 assert.equal(model.claims[0].tenantId,"t1");assert.equal(model.claims[0].serverTotalMinor,12345);assert.equal(model.claims[0].lines[0].amountMinor,12345);
});
