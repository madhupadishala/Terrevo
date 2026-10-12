export type ActivityKind="PLANNED_STOP"|"UNPLANNED_CALL"|"NCA"|"DCR";
export type ActivityStatus="PLANNED"|"COMPLETED"|"PENDING"|"APPROVED"|"REJECTED"|"SUBMITTED"|"REPORTED";
export type ReportScope={tenantId:string;authorizedForTenantId:string;contextKey:string;role:"MANAGER"|"ADMIN"|"FIELD";permittedTerritoryIds:string[];permittedTeamUserIds:string[];asOf:string};
export type ReportRecord={id:string;tenantId:string;territoryId:string;ownerUserId:string;workDate:string;kind:ActivityKind;status:ActivityStatus;sourceId:string;sourceType:string;observedAt:string};
export type ReportFilter={from:string;to:string;territoryId:string;ownerUserId:string};
export type MetricCounts={plannedStops:number;completedPlanned:number;unplannedPending:number;unplannedApproved:number;unplannedRejected:number;ncaReported:number;dcrSubmitted:number;plannedCompletionPercent:number|null};
export type ReportResult={rows:ReportRecord[];counts:MetricCounts;excluded:number};
export type ReportViewProps={scope:ReportScope;records?:ReportRecord[];loading?:boolean;error?:string|null;onRequestCsv?:(intent:{tenantId:string;contextKey:string;asOf:string;filter:ReportFilter;sourceIds:string[]})=>void};
export function canViewReports(s:ReportScope):boolean{return Boolean(s.tenantId&&s.tenantId===s.authorizedForTenantId&&s.contextKey&&(s.role==="MANAGER"||s.role==="ADMIN")&&s.permittedTerritoryIds.length&&s.permittedTeamUserIds.length&&Number.isFinite(Date.parse(s.asOf)));}
const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(`${day}T00:00:00Z`))&&new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)===day;
const validStatuses:Record<ActivityKind,readonly ActivityStatus[]>={PLANNED_STOP:["PLANNED","COMPLETED"],UNPLANNED_CALL:["PENDING","APPROVED","REJECTED"],NCA:["REPORTED"],DCR:["SUBMITTED"]};
export function reportRows(s:ReportScope,records:ReportRecord[],f:ReportFilter):ReportResult{
 if(!canViewReports(s)||(f.from&&!validDay(f.from))||(f.to&&!validDay(f.to))||(f.from&&f.to&&f.from>f.to))return {rows:[],counts:emptyCounts(),excluded:records.length};
 const eligible=records.filter(r=>{
  if(!r.id.trim()||!validDay(r.workDate)||!validStatuses[r.kind]?.includes(r.status)||r.tenantId!==s.tenantId||!s.permittedTerritoryIds.includes(r.territoryId)||!s.permittedTeamUserIds.includes(r.ownerUserId)||!r.sourceId||!r.sourceType||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>Date.parse(s.asOf)||!/^\d{4}-\d{2}-\d{2}$/.test(r.workDate))return false;
  if((f.from&&r.workDate<f.from)||(f.to&&r.workDate>f.to)||(f.territoryId&&r.territoryId!==f.territoryId)||(f.ownerUserId&&r.ownerUserId!==f.ownerUserId))return false;
  return true;
 });
 // Reject ambiguous source records instead of letting input order change compliance KPIs.
 const signatures=new Map<string,Set<string>>();for(const r of eligible){const key=JSON.stringify([r.kind,r.id]);const signature=JSON.stringify(r);if(!signatures.has(key))signatures.set(key,new Set());signatures.get(key)!.add(signature);}
 const seen=new Set<string>();const rows=eligible.filter(r=>{const key=JSON.stringify([r.kind,r.id]);if(signatures.get(key)!.size!==1||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>b.workDate.localeCompare(a.workDate)||a.id.localeCompare(b.id));
 const count=(kind:ActivityKind,status?:ActivityStatus)=>rows.filter(r=>r.kind===kind&&(!status||r.status===status)).length;
 const plannedStops=count("PLANNED_STOP");const completedPlanned=count("PLANNED_STOP","COMPLETED");
 const counts:MetricCounts={plannedStops,completedPlanned,unplannedPending:count("UNPLANNED_CALL","PENDING"),unplannedApproved:count("UNPLANNED_CALL","APPROVED"),unplannedRejected:count("UNPLANNED_CALL","REJECTED"),ncaReported:count("NCA","REPORTED"),dcrSubmitted:count("DCR","SUBMITTED"),plannedCompletionPercent:plannedStops?Math.round(completedPlanned*1000/plannedStops)/10:null};
 return {rows,counts,excluded:records.length-rows.length};
}
function emptyCounts():MetricCounts{return {plannedStops:0,completedPlanned:0,unplannedPending:0,unplannedApproved:0,unplannedRejected:0,ncaReported:0,dcrSubmitted:0,plannedCompletionPercent:null};}
export function csvCell(value:unknown):string{
 const raw=String(value??"");const safe=/^[\s\uFEFF]*[=+\-@\t\r]/u.test(raw)?`'${raw}`:raw;
 return `"${safe.replace(/"/g,'""')}"`;
}
export function reportCsv(rows:ReportRecord[]):string{
 return [["Work date","Territory","Employee","Kind","Status","Source type","Source ID","Observed at"].map(csvCell).join(","),...rows.map(r=>[r.workDate,r.territoryId,r.ownerUserId,r.kind,r.status,r.sourceType,r.sourceId,r.observedAt].map(csvCell).join(","))].join("\r\n");
}
