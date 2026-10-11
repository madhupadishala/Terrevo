import type {RbacService} from "../../rbac/src/index.ts";
import type {MastersRepository} from "../../masters/src/index.ts";

export type CustomerKind="doctor"|"chemist"|"stockist";
export type UnplannedCall={
 id:string;actorUserId:string;executionId:string;workDate:string;territoryId:string;customerType:CustomerKind;
 customerId:string;reason:string;remarks:string;durationMinutes:number;
 latitude:number;longitude:number;accuracyMeters:number;status:"SUBMITTED"|"APPROVED"|"REJECTED";
 managerComment:string|null;submittedAt:string;reviewedAt:string|null;
};
export type UnplannedCommand={
 operationId:string;executionId:string;territoryId:string;customerType:CustomerKind;customerId:string;
 reason:string;remarks:string;durationMinutes:number;latitude:number;longitude:number;accuracyMeters:number;
};
export type UnplannedRepository={
 submit(t:string,u:string,command:UnplannedCommand):Promise<string>;
 own(t:string,u:string,token:string):Promise<UnplannedCall[]>;
 pending(t:string,token:string):Promise<UnplannedCall[]>;
 byId(t:string,id:string,token:string):Promise<UnplannedCall|null>;
 decide(t:string,actor:string,id:string,decision:"APPROVE"|"REJECT",comment:string|null):Promise<void>;
};
export class UnplannedInputError extends Error{}
export class UnplannedNotFoundError extends Error{}
export class UnplannedConflictError extends Error{}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(value:unknown,name:string):string{
 if(typeof value!=="string"||!UUID.test(value))throw new UnplannedInputError(name+" must be UUID");
 return value;
}
function text(value:unknown,name:string,max:number,required=true):string{
 if(value==null||value===""){if(!required)return "";throw new UnplannedInputError(name+" is required");}
 if(typeof value!=="string"||(!value.trim()&&required)||value.trim().length>max)throw new UnplannedInputError("Invalid "+name);
 return value.trim();
}
function number(value:unknown,name:string,min:number,max:number):number{
 if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max)throw new UnplannedInputError("Invalid "+name);
 return value;
}
export function createUnplannedCallService(repo:UnplannedRepository,rbac:RbacService,masters:MastersRepository){
 return {
  own:(tenantId:string,userId:string,token:string)=>repo.own(tenantId,userId,token),
  async pending(tenantId:string,token:string){
   const rows=await repo.pending(tenantId,token);
   const eligible=await Promise.all(rows.map(async row=>{
    try { await rbac.authorize(tenantId,"TOUR_APPROVE",row.territoryId,token);return row; }
    catch { return null; }
   }));
   return eligible.filter((row):row is UnplannedCall=>row!==null);
  },
  async submit(tenantId:string,userId:string,token:string,raw:Record<string,unknown>){
   const kind=raw.customerType;
   if(kind!=="doctor"&&kind!=="chemist"&&kind!=="stockist")throw new UnplannedInputError("Invalid customerType");
   const command:UnplannedCommand={
    operationId:id(raw.operationId,"operationId"),executionId:id(raw.executionId,"executionId"),
    territoryId:id(raw.territoryId,"territoryId"),customerType:kind,customerId:id(raw.customerId,"customerId"),
    reason:text(raw.reason,"reason",500),remarks:text(raw.remarks,"remarks",2000,true),
    durationMinutes:number(raw.durationMinutes,"durationMinutes",1,1440),
    latitude:number(raw.latitude,"latitude",-90,90),
    longitude:number(raw.longitude,"longitude",-180,180),
    accuracyMeters:number(raw.accuracyMeters,"accuracyMeters",0,1000),
   };
   if(!Number.isInteger(command.durationMinutes))throw new UnplannedInputError("durationMinutes must be an integer");
   await rbac.authorize(tenantId,"TOUR_PLAN_OWN",command.territoryId,token);
   const masterKind=kind==="doctor"?"doctors":kind==="chemist"?"chemists":"stockists";
   const customer=await masters.get(masterKind,tenantId,command.customerId,token);
   if(!customer||customer.status!=="active"||customer.territoryId!==command.territoryId)
    throw new UnplannedInputError("Customer is not active in the authorized territory");
   const recordId=await repo.submit(tenantId,userId,command);
   const saved=await repo.byId(tenantId,recordId,token);
   if(!saved||saved.status!=="SUBMITTED")throw new UnplannedConflictError("Unplanned call was not confirmed");
   return saved;
  },
  async decide(tenantId:string,actor:string,token:string,idValue:unknown,raw:Record<string,unknown>){
   const recordId=id(idValue,"callId");
   if(raw.decision!=="APPROVE"&&raw.decision!=="REJECT")throw new UnplannedInputError("Invalid decision");
   const comment=text(raw.comment,"comment",1000,raw.decision==="REJECT");
   const row=await repo.byId(tenantId,recordId,token);
   if(!row)throw new UnplannedNotFoundError("Unplanned call not found or not visible");
   if(row.status!=="SUBMITTED")throw new UnplannedConflictError("Only submitted calls can be reviewed");
   if(row.actorUserId===actor)throw new UnplannedConflictError("A representative cannot review their own call");
   await rbac.authorize(tenantId,"TOUR_APPROVE",row.territoryId,token);
   await repo.decide(tenantId,actor,recordId,raw.decision,comment||null);
   const after=await repo.byId(tenantId,recordId,token);
   if(!after||after.status!==(raw.decision==="APPROVE"?"APPROVED":"REJECTED"))
    throw new UnplannedConflictError("Manager review could not be confirmed");
   return after;
  },
 };
}
