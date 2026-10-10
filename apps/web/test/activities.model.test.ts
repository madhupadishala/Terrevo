import assert from "node:assert/strict";
import test from "node:test";
import {emptyActivityDraft,validateActivityDraft} from "../src/features/activities/model.ts";
const ctx={territories:[{id:"t",name:"North"}],customers:{doctors:[{id:"d",code:"D",name:"Doctor",status:"active"}]},plannedCalls:[{planStopId:"s",label:"Doctor",territoryId:"t",workDate:"2026-10-11"}],towns:[{id:"town",name:"Test Town"}],ncaSubtypes:[{code:"M",label:"Meeting"}]};
const base={...emptyActivityDraft("org","2026-10-11"),territoryId:"t",reason:"Visit",durationMinutes:30};
test("planned call must be linked to existing stop",()=>{assert.ok(validateActivityDraft(base,ctx).length);assert.deepEqual(validateActivityDraft({...base,plannedStopId:"s"},ctx),[]);});
test("unplanned requires actual authorized customer and reason",()=>{assert.ok(validateActivityDraft({...base,kind:"UNPLANNED_CALL",customerType:"doctor",customerId:"unknown"},ctx).length);assert.deepEqual(validateActivityDraft({...base,kind:"UNPLANNED_CALL",customerType:"doctor",customerId:"d"},ctx),[]);});
test("non-call cannot masquerade as doctor call",()=>{assert.deepEqual(validateActivityDraft({...base,kind:"NON_CALL_ACTIVITY",ncaPhase:"REPORT",ncaSubtype:"M"},ctx),[]);assert.ok(validateActivityDraft({...base,kind:"NON_CALL_ACTIVITY",ncaSubtype:"M",customerId:"d"},ctx).length);});
test("reject invalid duration, date, remarks and evidence",()=>{assert.ok(validateActivityDraft({...base,plannedStopId:"s",durationMinutes:-3},ctx).length);assert.ok(validateActivityDraft({...base,plannedStopId:"s",workDate:"2026-02-31"},ctx).length);assert.ok(validateActivityDraft({...base,plannedStopId:"s",remarks:"x".repeat(2001)},ctx).length);});

test("guide-aligned NCA planning requires selected authorized town",()=>{assert.ok(validateActivityDraft({...base,kind:"NON_CALL_ACTIVITY",ncaPhase:"PLAN",ncaSubtype:"M"},ctx).length);assert.deepEqual(validateActivityDraft({...base,kind:"NON_CALL_ACTIVITY",ncaPhase:"PLAN",ncaSubtype:"M",townId:"town"},ctx),[]);});
