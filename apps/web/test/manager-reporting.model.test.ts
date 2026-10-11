import assert from "node:assert/strict";import test from "node:test";
import {canViewReports,csvCell,reportCsv,reportRows,type ReportScope,type ReportRecord} from "../src/features/manager-reporting/model.ts";
const scope:ReportScope={tenantId:"t",authorizedForTenantId:"t",contextKey:"session",role:"MANAGER",permittedTerritoryIds:["east"],permittedTeamUserIds:["u"],asOf:"2026-10-11T10:00:00Z"};
const mk=(id:string,kind:ReportRecord["kind"],status:ReportRecord["status"]):ReportRecord=>({id,kind,status,tenantId:"t",territoryId:"east",ownerUserId:"u",workDate:"2026-10-10",sourceId:`src-${id}`,sourceType:"SERVER",observedAt:"2026-10-11T09:00:00Z"});
const filter={from:"",to:"",territoryId:"",ownerUserId:""};
test("authoritative scope requires manager, session, tenant and team",()=>{assert.equal(canViewReports(scope),true);assert.equal(canViewReports({...scope,role:"FIELD"}),false);assert.equal(canViewReports({...scope,authorizedForTenantId:"else"}),false);assert.equal(canViewReports({...scope,contextKey:""}),false);assert.equal(canViewReports({...scope,permittedTerritoryIds:[]}),false);});
test("separates pending and approved unplanned, NCA, DCR and planned",()=>{const rows=[mk("a","PLANNED_STOP","COMPLETED"),mk("b","PLANNED_STOP","PLANNED"),mk("c","UNPLANNED_CALL","PENDING"),mk("d","UNPLANNED_CALL","APPROVED"),mk("e","UNPLANNED_CALL","REJECTED"),mk("f","NCA","REPORTED"),mk("g","DCR","SUBMITTED"),mk("d","UNPLANNED_CALL","APPROVED")];const {counts}=reportRows(scope,rows,filter);assert.deepEqual(counts,{plannedStops:2,completedPlanned:1,unplannedPending:1,unplannedApproved:1,unplannedRejected:1,ncaReported:1,dcrSubmitted:1,plannedCompletionPercent:50});assert.equal(counts.completedPlanned,1);});
test("cross territory, tenant, team and future as-of evidence are excluded",()=>{const rows=[mk("ok","DCR","SUBMITTED"),{...mk("west","DCR","SUBMITTED"),territoryId:"west"},{...mk("foreign","DCR","SUBMITTED"),tenantId:"foreign"},{...mk("user","DCR","SUBMITTED"),ownerUserId:"other"},{...mk("future","DCR","SUBMITTED"),observedAt:"2026-10-12T00:00:00Z"}];assert.deepEqual(reportRows(scope,rows,filter).rows.map(r=>r.id),["ok"]);assert.equal(reportRows(scope,rows,{...filter,from:"2026-10-11"}).rows.length,0);});
test("zero denominators produce N/A and CSV serializes formula/quotes safely",()=>{assert.equal(reportRows(scope,[],filter).counts.plannedCompletionPercent,null);for(const bad of ["=SUM(A1)","+42","-4","@cmd"," \t=1"])assert.equal(csvCell(bad).slice(0,2),String.fromCharCode(34,39));assert.equal(csvCell('hi"again'),'"hi""again"');assert.ok(reportCsv([{...mk("x","NCA","REPORTED"),sourceId:"=unsafe"}]).includes(String.fromCharCode(34,39)+'=unsafe"'));});

test("conflicting eligible evidence is excluded from KPI calculation regardless of input order",()=>{const a=mk("conflict","UNPLANNED_CALL","PENDING");const b={...a,status:"APPROVED" as const,observedAt:"2026-10-11T09:30:00Z"};for(const rows of [[a,b],[b,a]]){const result=reportRows(scope,rows,filter);assert.equal(result.rows.length,0);assert.equal(result.counts.unplannedApproved,0);assert.equal(result.counts.unplannedPending,0);assert.equal(result.excluded,2);}});

test("invalid calendar days, blank record identities and impossible state pairs cannot inflate KPIs",()=>{
 const bad=[{...mk("date","PLANNED_STOP","COMPLETED"),workDate:"2026-02-30"},mk("","PLANNED_STOP","COMPLETED"),mk("state","PLANNED_STOP","REJECTED")];
 const result=reportRows(scope,bad,filter);assert.equal(result.rows.length,0);assert.equal(result.counts.plannedStops,0);
});
test("invalid or reversed report filters fail closed",()=>{
 for(const f of [{...filter,from:"2026-02-30"},{...filter,from:"2026-10-11",to:"2026-10-10"}])assert.equal(reportRows(scope,[mk("x","DCR","SUBMITTED")],f).rows.length,0);
});
