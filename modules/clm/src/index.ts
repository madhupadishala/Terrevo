export type ClmSlide={id:string;title:string;body:string;sequence:number};
export type ClmAsset={id:string;code:string;title:string;version:string;category:string;status:"APPROVED"|"EXPIRED"|"WITHDRAWN"|"DRAFT";effectiveFrom:string;expiresAt:string|null;productIds:string[];slides:ClmSlide[]};
export type ClmSession={id:string;visitId:string;assetId:string;startedAt:string;endedAt:string;reaction:"POSITIVE"|"NEUTRAL"|"NEGATIVE";slideDwells:Array<{slideId:string;durationMs:number}>};
export type ClmRepository={
 listApproved(tenantId:string,accessToken:string):Promise<ClmAsset[]>;
 saveDetailing(tenantId:string,userId:string,visitId:string,input:{operationId:string;assetId:string;startedAt:string;endedAt:string;reaction:ClmSession["reaction"];slideDwells:Array<{slideId:string;durationMs:number}>}):Promise<string>;
 getSession(tenantId:string,id:string,accessToken:string):Promise<ClmSession|null>;
 listVisitSessions(tenantId:string,visitId:string,accessToken:string):Promise<ClmSession[]>;
};
export class ClmInputError extends Error{}
export class ClmConflictError extends Error{}
export class ClmNotFoundError extends Error{}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(v:unknown,f:string){if(typeof v!=="string"||!UUID.test(v))throw new ClmInputError(`${f} must be a UUID`);return v}
function iso(v:unknown,f:string){if(typeof v!=="string"||!Number.isFinite(Date.parse(v)))throw new ClmInputError(`${f} must be ISO date-time`);return v}
function reaction(v:unknown):ClmSession["reaction"]{if(v!=="POSITIVE"&&v!=="NEUTRAL"&&v!=="NEGATIVE")throw new ClmInputError("Invalid doctor reaction");return v}
function dwells(v:unknown){if(!Array.isArray(v)||v.length<1||v.length>100)throw new ClmInputError("slideDwells must contain 1 to 100 entries");return v.map((x,i)=>{if(!x||typeof x!=="object"||Array.isArray(x))throw new ClmInputError("Invalid slide dwell "+i);const r=x as Record<string,unknown>;const duration=Number(r.durationMs);if(!Number.isInteger(duration)||duration<0||duration>3600000)throw new ClmInputError("Invalid slide duration");return{slideId:uuid(r.slideId,"slideId"),durationMs:duration}})}
export function createClmService(repository:ClmRepository){
 return{
  listApproved:(t:string,token:string)=>repository.listApproved(t,token),
  async finishDetailing(t:string,u:string,token:string,visitValue:unknown,value:Record<string,unknown>){
   const visitId=uuid(visitValue,"visitId"),operationId=uuid(value.operationId,"operationId"),assetId=uuid(value.assetId,"assetId");
   const startedAt=iso(value.startedAt,"startedAt"),endedAt=iso(value.endedAt,"endedAt");
   if(new Date(endedAt).getTime()<new Date(startedAt).getTime())throw new ClmInputError("Detailing end must follow start");
   const id=await repository.saveDetailing(t,u,visitId,{operationId,assetId,startedAt,endedAt,reaction:reaction(value.reaction),slideDwells:dwells(value.slideDwells)});
   const row=await repository.getSession(t,id,token);if(!row)throw new ClmConflictError("Detailing session could not be confirmed");return row;
  },
  listVisit:(t:string,token:string,visitValue:unknown)=>repository.listVisitSessions(t,uuid(visitValue,"visitId"),token),
 };
}
