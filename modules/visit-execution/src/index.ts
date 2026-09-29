import type { RbacService } from "../../rbac/src/index.ts";

export type GeofenceVerification =
  | "VERIFIED"
  | "OUTSIDE_GEOFENCE"
  | "LOW_ACCURACY"
  | "NO_TARGET_COORDINATES";

export type Visit = {
  id: string;
  executionId: string;
  planStopId: string;
  territoryId: string;
  status: "CHECKED_IN" | "CHECKED_OUT";
  verification: GeofenceVerification;
  exceptionStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  distanceMeters: number | null;
  geofenceRadiusMeters: number;
  checkinAt: string;
  checkoutAt: string | null;
};

export type FieldSettings = {
  geofenceRadiusMeters: 50 | 100 | 200;
  maxGpsAccuracyMeters: number;
};

export type PresenceIntegrityStatus = "CONSISTENT" | "REVIEW_REQUIRED" | "SPOOF_SUSPECTED";

export type PresenceIntegritySample = {
  sequence: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  mocked: boolean | null;
  distanceFromPreviousMeters: number;
  speedFromPreviousKph: number | null;
};

export type PresenceIntegrity = {
  id: string;
  visitId: string;
  executionId: string;
  status: PresenceIntegrityStatus;
  sampleCount: number;
  totalDistanceMeters: number;
  maxSegmentSpeedKph: number;
  mockedDetected: boolean;
  reason: string;
  deviceId: string | null;
  serverDelaySeconds: number;
  recordedAt: string;
  samples: PresenceIntegritySample[];
};

export type PresenceSampleInput = {
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  mocked: boolean | null;
};

export type VisitRepository = {
  getSettings(tenantId: string, accessToken: string): Promise<FieldSettings>;
  updateSettings(tenantId: string, settings: FieldSettings): Promise<void>;
  checkIn(
    tenantId: string,
    userId: string,
    input: {
      operationId: string;
      planStopId: string;
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      exceptionReason: string | null;
    },
  ): Promise<string>;
  getOpen(tenantId: string, accessToken: string): Promise<Visit | null>;
  getById(tenantId: string, visitId: string, accessToken: string): Promise<Visit | null>;
  checkOut(
    tenantId: string,
    userId: string,
    visitId: string,
    input: {
      operationId: string;
      latitude: number;
      longitude: number;
      accuracyMeters: number;
    },
  ): Promise<void>;
  recordDeparture(
    tenantId: string,
    userId: string,
    visitId: string,
    input: { operationId: string; samples: PresenceSampleInput[] },
  ): Promise<string>;
  getPresence(tenantId: string, visitId: string, accessToken: string): Promise<PresenceIntegrity | null>;
  listPendingExceptions(tenantId: string, accessToken: string): Promise<Array<Visit & { planId: string }>>;
  decideException(
    tenantId: string,
    actorUserId: string,
    visitId: string,
    decision: "APPROVE" | "REJECT",
    comment: string | null,
  ): Promise<void>;
};

export class VisitInputError extends Error {}
export class VisitConflictError extends Error {}
export class VisitNotFoundError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value:unknown,field:string){if(typeof value!=="string"||!UUID.test(value))throw new VisitInputError(`${field} must be a UUID`);return value}
function num(value:unknown,field:string,min:number,max:number){if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max)throw new VisitInputError(`Invalid ${field}`);return value}
function reason(value:unknown,max=1000){if(value==null||value==="")return null;if(typeof value!=="string")throw new VisitInputError("Invalid reason");const v=value.trim();if(!v||v.length>max)throw new VisitInputError("Invalid reason");return v}
function timestamp(value:unknown,field:string){if(typeof value!=="string")throw new VisitInputError(`Invalid ${field}`);const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))throw new VisitInputError(`Invalid ${field}`);return parsed.toISOString()}
function presenceSamples(value:unknown):PresenceSampleInput[]{
  if(!Array.isArray(value)||value.length<3||value.length>10)throw new VisitInputError("samples must contain 3 to 10 location points");
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new VisitInputError(`Invalid sample at index ${index}`);
    const sample=raw as Record<string,unknown>;
    const mocked=sample.mocked;
    if(mocked!==null&&mocked!==undefined&&typeof mocked!=="boolean")throw new VisitInputError("Invalid mocked flag");
    return {
      capturedAt:timestamp(sample.capturedAt,"capturedAt"),
      latitude:num(sample.latitude,"latitude",-90,90),
      longitude:num(sample.longitude,"longitude",-180,180),
      accuracyMeters:num(sample.accuracyMeters,"accuracyMeters",0,1000),
      mocked:mocked==null?null:mocked,
    };
  });
}

export function createVisitService(repository:VisitRepository,rbac:RbacService){
  return {
    getSettings(tenantId:string,accessToken:string){return repository.getSettings(tenantId,accessToken)},
    async updateSettings(tenantId:string,accessToken:string,value:Record<string,unknown>){
      const radius=value.geofenceRadiusMeters;
      if(radius!==50&&radius!==100&&radius!==200)throw new VisitInputError("Geofence radius must be 50, 100 or 200 meters");
      const maxAccuracy=num(value.maxGpsAccuracyMeters,"maxGpsAccuracyMeters",5,500);
      await rbac.authorize(tenantId,"ORG_MANAGE",null,accessToken);
      const settings={geofenceRadiusMeters:radius,maxGpsAccuracyMeters:maxAccuracy} as FieldSettings;
      await repository.updateSettings(tenantId,settings);
      return settings;
    },
    async checkIn(tenantId:string,userId:string,accessToken:string,value:Record<string,unknown>){
      const input={
        operationId:uuid(value.operationId,"operationId"),
        planStopId:uuid(value.planStopId,"planStopId"),
        latitude:num(value.latitude,"latitude",-90,90),
        longitude:num(value.longitude,"longitude",-180,180),
        accuracyMeters:num(value.accuracyMeters,"accuracyMeters",0,1000),
        exceptionReason:reason(value.exceptionReason),
      };
      const id=await repository.checkIn(tenantId,userId,input);
      const visit=await repository.getById(tenantId,id,accessToken);
      if(!visit)throw new VisitConflictError("Checked-in visit could not be confirmed");
      return visit;
    },
    getOpen(tenantId:string,accessToken:string){return repository.getOpen(tenantId,accessToken)},
    async checkOut(tenantId:string,userId:string,accessToken:string,visitIdValue:unknown,value:Record<string,unknown>){
      const visitId=uuid(visitIdValue,"visitId");
      const input={
        operationId:uuid(value.operationId,"operationId"),
        latitude:num(value.latitude,"latitude",-90,90),
        longitude:num(value.longitude,"longitude",-180,180),
        accuracyMeters:num(value.accuracyMeters,"accuracyMeters",0,1000),
      };
      const existing=await repository.getById(tenantId,visitId,accessToken);
      if(!existing)throw new VisitNotFoundError("Visit not found");
      await repository.checkOut(tenantId,userId,visitId,input);
      const closed=await repository.getById(tenantId,visitId,accessToken);
      if(!closed||closed.status!=="CHECKED_OUT")throw new VisitConflictError("Visit checkout could not be confirmed");
      return closed;
    },
    async recordDeparture(tenantId:string,userId:string,accessToken:string,visitIdValue:unknown,value:Record<string,unknown>){
      const visitId=uuid(visitIdValue,"visitId");
      const existing=await repository.getById(tenantId,visitId,accessToken);
      if(!existing)throw new VisitNotFoundError("Visit not found");
      if(existing.status!=="CHECKED_OUT")throw new VisitConflictError("Visit must be checked out before presence evidence is recorded");
      const input={operationId:uuid(value.operationId,"operationId"),samples:presenceSamples(value.samples)};
      const id=await repository.recordDeparture(tenantId,userId,visitId,input);
      const presence=await repository.getPresence(tenantId,visitId,accessToken);
      if(!presence||presence.id!==id)throw new VisitConflictError("Presence evidence could not be confirmed");
      return presence;
    },
    async getPresence(tenantId:string,accessToken:string,visitIdValue:unknown){
      const visitId=uuid(visitIdValue,"visitId");
      const presence=await repository.getPresence(tenantId,visitId,accessToken);
      if(!presence)throw new VisitNotFoundError("Presence evidence not found");
      return presence;
    },
    listPendingExceptions(tenantId:string,accessToken:string){return repository.listPendingExceptions(tenantId,accessToken)},
    async decideException(tenantId:string,actorUserId:string,accessToken:string,visitIdValue:unknown,value:Record<string,unknown>){
      const visitId=uuid(visitIdValue,"visitId");
      if(value.decision!=="APPROVE"&&value.decision!=="REJECT")throw new VisitInputError("Invalid exception decision");
      const comment=reason(value.comment);
      if(value.decision==="REJECT"&&!comment)throw new VisitInputError("Comment is required when rejecting an exception");
      const pending=await repository.listPendingExceptions(tenantId,accessToken);
      const visit=pending.find((item)=>item.id===visitId);
      if(!visit)throw new VisitNotFoundError("Pending GPS exception not found");
      await rbac.authorize(tenantId,"TOUR_APPROVE",visit.territoryId,accessToken);
      await repository.decideException(tenantId,actorUserId,visitId,value.decision,comment);
    },
  };
}
