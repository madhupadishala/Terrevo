export type EvidenceScope={tenantId:string;authorizedForTenantId:string;contextKey:string;viewerUserId:string;role:"FIELD"|"MANAGER"|"ADMIN";permittedUserIds:string[]};
export type ExpenseLine={id:string;category:string;amountMinor:number;receiptRequired:boolean};
export type Claim={id:string;tenantId:string;ownerUserId:string;workDate:string;currency:string;serverTotalMinor:number;status:"DRAFT"|"SUBMITTED"|"APPROVED"|"REJECTED";lines:ExpenseLine[];sourceId:string;asOf:string};
export type ReceiptManifest={id:string;tenantId:string;claimId:string;lineId:string;status:"VERIFIED"|"PENDING"|"MISSING"|"REVOKED";documentRef:string;verifiedAt?:string};
export type TravelEvidence={tenantId:string;ownerUserId:string;workDate:string;sourceId:string;distanceMeters:number;method:"SERVER_GPS"|"SERVER_ROUTE"|"UNVERIFIED"};
export type AttendanceEvidence={id:string;tenantId:string;ownerUserId:string;workDate:string;state:"PRESENT"|"LEAVE"|"ABSENT"|"PENDING";dayClosed:boolean;sourceId:string;asOf:string};
export type PolicyLimit={tenantId:string;category:string;maxMinor:number;currency:string;effectiveFrom:string;expiresAt:string;policyId:string};
export type ClaimReview={claim:Claim;computedMinor:number|null;discrepancy:boolean;missingReceipts:string[];overLimitLines:string[];receiptStates:ReceiptManifest[];travel:TravelEvidence[];attendance:AttendanceEvidence|null};
export type EvidenceViewProps={scope:EvidenceScope;claims?:Claim[];receipts?:ReceiptManifest[];travel?:TravelEvidence[];attendance?:AttendanceEvidence[];policies?:PolicyLimit[];loading?:boolean;error?:string|null;onRequestReceiptReview?:(intent:{tenantId:string;contextKey:string;claimId:string;receiptId:string})=>void};
export function allowedOwner(s:EvidenceScope,userId:string){return Boolean(s.tenantId&&s.tenantId===s.authorizedForTenantId&&s.contextKey&&s.viewerUserId&&userId&&(s.role==="FIELD"?userId===s.viewerUserId:s.permittedUserIds.includes(userId)));}
export function verifiedMinorTotal(lines:ExpenseLine[]):number|null{if(lines.some(l=>!Number.isSafeInteger(l.amountMinor)||l.amountMinor<0))return null;const total=lines.reduce((s,l)=>s+l.amountMinor,0);return Number.isSafeInteger(total)?total:null;}
export function reviewClaims(s:EvidenceScope,claims:Claim[],receipts:ReceiptManifest[],travel:TravelEvidence[],attendance:AttendanceEvidence[],policies:PolicyLimit[]):ClaimReview[]{
 return claims.filter(c=>c.tenantId===s.tenantId&&allowedOwner(s,c.ownerUserId)&&!!c.sourceId&&Number.isFinite(Date.parse(c.asOf))).map(claim=>{
  const matchingReceipts=receipts.filter(r=>r.tenantId===s.tenantId&&r.claimId===claim.id&&claim.lines.some(l=>l.id===r.lineId));
  const missingReceipts=claim.lines.filter(l=>l.receiptRequired&&!matchingReceipts.some(r=>r.lineId===l.id&&r.status==="VERIFIED"&&!!r.documentRef)).map(l=>l.id);
  const overLimitLines=claim.lines.filter(l=>policies.some(p=>p.tenantId===s.tenantId&&p.category===l.category&&p.currency===claim.currency&&p.effectiveFrom<=claim.workDate&&p.expiresAt>=claim.workDate&&l.amountMinor>p.maxMinor)).map(l=>l.id);
  const computedMinor=verifiedMinorTotal(claim.lines);
  const validTravel=travel.filter(t=>t.tenantId===s.tenantId&&t.ownerUserId===claim.ownerUserId&&t.workDate===claim.workDate&&!!t.sourceId&&Number.isFinite(t.distanceMeters)&&t.distanceMeters>=0);
  const ownAttendance=attendance.find(a=>a.tenantId===s.tenantId&&a.ownerUserId===claim.ownerUserId&&a.workDate===claim.workDate&&!!a.sourceId)||null;
  return {claim,computedMinor,discrepancy:computedMinor===null||!Number.isSafeInteger(claim.serverTotalMinor)||computedMinor!==claim.serverTotalMinor,missingReceipts,overLimitLines,receiptStates:matchingReceipts,travel:validTravel,attendance:ownAttendance};
 }).sort((a,b)=>b.claim.workDate.localeCompare(a.claim.workDate)||a.claim.id.localeCompare(b.claim.id));
}
