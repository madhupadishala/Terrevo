import assert from "node:assert/strict";
import test from "node:test";
import {eligibleAssets,clampSlideIndex,createDetailingSessionDraft} from "../src/features/edetailing/model.ts";
const a={id:"a",tenantId:"org",title:"Approved title",productIds:["p"],category:"information",status:"APPROVED" as const,slides:[{id:"1",title:"Controlled approved slide",body:"Reviewed body"}]};
test("approved, effective, tenant-scoped content only",()=>{
 assert.equal(eligibleAssets([a,{...a,status:"DRAFT"},{...a,tenantId:"other"},{...a,expiresAt:"2020-01-01"}],"org","2026-10-11").length,1);
 assert.deepEqual(eligibleAssets([],"org","2026-10-11"),[]);
});
test("navigation index is bounded",()=>{assert.equal(clampSlideIndex(-99,3),0);assert.equal(clampSlideIndex(99,3),2);assert.equal(clampSlideIndex(99,0),0);});
test("drafts only from explicit approved slide visits",()=>{
 const v=createDetailingSessionDraft("org",a,"start","end",[{slideId:"1",durationMs:400},{slideId:"unknown",durationMs:100}]);
 assert.equal(v.slideVisits.length,1);assert.equal(v.assetId,"a");
});
