import test from "node:test";
import assert from "node:assert/strict";
import {customerRelationships} from "../src/customer-links-adapter.ts";
const groups={doctors:[{id:"source",name:"Doctor",code:"D",status:"active"}],chemists:[{id:"target",name:"Chemist",code:"C",status:"active"}]};
const link={id:"link",tenantId:"tenant",sourceId:"source",targetId:"target",territoryId:"territory",relation:"verified relation",approval:"APPROVED" as const,evidenceId:"evidence",verifiedAt:"2026-10-11T10:00:00Z"};
test("relationship adapter derives types from authorized canonical masters without inventing evidence",()=>{
 assert.deepEqual(customerRelationships("tenant","source",groups,[link]),[{id:"link",tenantId:"tenant",sourceKind:"doctor",sourceId:"source",targetKind:"chemist",targetId:"target",relationship:"verified relation"}]);
});
test("relationship adapter excludes foreign, hidden, ambiguous, inactive and unverified edges",()=>{
 for(const row of [{...link,tenantId:"foreign"},{...link,sourceId:"other"},{...link,targetId:"hidden"},{...link,evidenceId:" "},{...link,verifiedAt:"invalid"},{...link,approval:"PENDING" as const}])assert.deepEqual(customerRelationships("tenant","source",groups,[row]),[]);
 assert.deepEqual(customerRelationships("tenant","source",{...groups,stockists:groups.chemists},[link]),[]);
 assert.deepEqual(customerRelationships("tenant","source",{...groups,chemists:groups.chemists.map(r=>({...r,status:"inactive"}))},[link]),[]);
 assert.deepEqual(customerRelationships("tenant","source",{...groups,doctors:groups.doctors.map(r=>({...r,tenantId:"foreign"}))},[link]),[]);
});
