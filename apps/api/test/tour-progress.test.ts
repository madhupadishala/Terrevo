import test from "node:test";
import assert from "node:assert/strict";
import { createTourProgressService } from "../../../modules/tour-progress/src/index.ts";

test("TRV-PROG-006 returns null when no active tour exists",async()=>{
  const service=createTourProgressService({getCurrent:async()=>null});
  assert.equal(await service.getCurrent("t","token"),null);
});

test("TRV-PROG-001 returns repository projection with stable plan stop IDs",async()=>{
  const progress={
    executionId:"e",workDate:"2026-09-29",territoryId:"t",startedAt:"2026-09-29T00:00:00Z",
    serverNow:"2026-09-29T01:00:00Z",requiredMinutes:480,elapsedMinutes:60,remainingMinutes:420,
    plannedCount:2,completedCount:0,inProgressCount:0,pendingCount:2,
    stops:[
      {planStopId:"s1",sequence:1,type:"doctor" as const,targetId:"d",targetName:"Dr A",status:"PENDING" as const},
      {planStopId:"s2",sequence:2,type:"chemist" as const,targetId:"c",targetName:"Chemist B",status:"PENDING" as const},
    ],
  };
  const service=createTourProgressService({getCurrent:async()=>progress});
  assert.deepEqual(await service.getCurrent("t","token"),progress);
});
