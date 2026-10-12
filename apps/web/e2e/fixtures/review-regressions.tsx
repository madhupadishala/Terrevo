// Browser-only component harness; never imported by the application entry point.
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {useLayoutEffect} from 'react';
import {ManagerReportingView,type ReportViewProps} from '../../src/features/manager-reporting/ManagerReportingView';
import {WorkforceEvidenceView} from '../../src/features/workforce-evidence/WorkforceEvidenceView';
const root=createRoot(document.getElementById('root')!);
const intents:unknown[]=[];
function ReportProbe({exportOnCommit,...props}:ReportViewProps & {exportOnCommit:boolean}){
 useLayoutEffect(()=>{
  if(exportOnCommit){
   const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Request authorized CSV');
   if(!button)throw Error('Missing export');button.click();
  }
 },[props.scope.tenantId,exportOnCommit]);
 return <ManagerReportingView {...props}/>;
}
function report(tenantId:string,exportOnCommit=false){
 const scope={tenantId,authorizedForTenantId:tenantId,contextKey:tenantId,role:'MANAGER' as const,permittedTerritoryIds:['east'],permittedTeamUserIds:['u'],asOf:'2026-10-11T10:00:00Z'};
 const record={id:'row',kind:'PLANNED_STOP' as const,status:'COMPLETED' as const,tenantId,territoryId:'east',ownerUserId:'u',workDate:'2026-10-10',sourceId:'source-'+tenantId,sourceType:'SERVER',observedAt:'2026-10-11T09:00:00Z'};
 flushSync(()=>root.render(<ReportProbe exportOnCommit={exportOnCommit} scope={scope} records={[record]} onRequestCsv={intent=>intents.push(intent)}/>));
}
function workforce(contextKey='session',throws=false){
 const scope={tenantId:'a',authorizedForTenantId:'a',contextKey,viewerUserId:'u',role:'FIELD' as const,permittedUserIds:['u']};
 const claim={id:'claim',tenantId:'a',ownerUserId:'u',workDate:'2026-10-10',currency:'INR',serverTotalMinor:5000,status:'SUBMITTED' as const,lines:[{id:'line',category:'TRAVEL',amountMinor:5000,receiptRequired:true}],sourceId:'source',asOf:'2026-10-10T10:00:00Z'};
 const receipt={id:'first',tenantId:'a',claimId:'claim',lineId:'line',status:'PENDING' as const,documentRef:'doc'};
 flushSync(()=>root.render(<WorkforceEvidenceView scope={scope} claims={[claim]} receipts={[receipt,{...receipt,id:'second'}]} onRequestReceiptReview={intent=>{if(throws)throw Error('intent refused');intents.push(intent);}}/>));
}
Object.assign(window,{reviewHarness:{report,workforce,intents}});
