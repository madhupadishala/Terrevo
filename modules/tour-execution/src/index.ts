import type { RbacService } from "../../rbac/src/index.ts";

export type StartTourOption = {
  planId: string;
  planDayId: string;
  workDate: string;
  territoryId: string;
};

export type TourExecution = {
  id: string;
  operationId: string;
  planId: string;
  planDayId: string;
  workDate: string;
  territoryId: string;
  status: "ACTIVE" | "SUBMITTED";
  startedAt: string;
  deviceStartedAt: string | null;
  requiredMinutes: number;
  startLatitude: number;
  startLongitude: number;
  startAccuracyMeters: number;
  deviceId: string | null;
  networkType: string | null;
  appVersion: string | null;
};

export type StartTourCommand = {
  operationId: string;
  planDayId: string;
  deviceStartedAt: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  deviceId: string | null;
  networkType: string | null;
  appVersion: string | null;
};

export type TourExecutionRepository = {
  listStartOptions(tenantId: string, accessToken: string): Promise<StartTourOption[]>;
  getActive(tenantId: string, accessToken: string): Promise<TourExecution | null>;
  start(tenantId: string, userId: string, command: StartTourCommand): Promise<string>;
};

export class TourExecutionInputError extends Error {}
export class TourExecutionConflictError extends Error {}
export class TourExecutionNotFoundError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value:unknown,field:string):string {
  if(typeof value!=="string"||!UUID.test(value)) throw new TourExecutionInputError(`${field} must be a UUID`);
  return value;
}
function number(value:unknown,field:string,min:number,max:number):number {
  if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max) {
    throw new TourExecutionInputError(`Invalid ${field}`);
  }
  return value;
}
function optionalText(value:unknown,field:string,max:number):string|null {
  if(value==null||value==="") return null;
  if(typeof value!=="string") throw new TourExecutionInputError(`Invalid ${field}`);
  const result=value.trim();
  if(!result||result.length>max) throw new TourExecutionInputError(`Invalid ${field}`);
  return result;
}
function optionalTimestamp(value:unknown):string|null {
  if(value==null||value==="") return null;
  if(typeof value!=="string") throw new TourExecutionInputError("Invalid deviceStartedAt");
  const parsed=new Date(value);
  if(Number.isNaN(parsed.getTime())) throw new TourExecutionInputError("Invalid deviceStartedAt");
  return parsed.toISOString();
}

export function createTourExecutionService(repository:TourExecutionRepository,rbac:RbacService){
  return {
    listStartOptions(tenantId:string,accessToken:string){
      return repository.listStartOptions(tenantId,accessToken);
    },
    getActive(tenantId:string,accessToken:string){
      return repository.getActive(tenantId,accessToken);
    },
    async start(
      tenantId:string,userId:string,accessToken:string,value:Record<string,unknown>
    ){
      const command:StartTourCommand={
        operationId:uuid(value.operationId,"operationId"),
        planDayId:uuid(value.planDayId,"planDayId"),
        deviceStartedAt:optionalTimestamp(value.deviceStartedAt),
        latitude:number(value.latitude,"latitude",-90,90),
        longitude:number(value.longitude,"longitude",-180,180),
        accuracyMeters:number(value.accuracyMeters,"accuracyMeters",0,1000),
        deviceId:optionalText(value.deviceId,"deviceId",200),
        networkType:optionalText(value.networkType,"networkType",40),
        appVersion:optionalText(value.appVersion,"appVersion",80),
      };

      const options=await repository.listStartOptions(tenantId,accessToken);
      const option=options.find((item)=>item.planDayId===command.planDayId);
      if(!option) throw new TourExecutionNotFoundError("Approved tour day is not available to start");
      await rbac.authorize(tenantId,"TOUR_PLAN_OWN",option.territoryId,accessToken);

      const executionId=await repository.start(tenantId,userId,command);
      const active=await repository.getActive(tenantId,accessToken);
      if(!active||active.id!==executionId) {
        throw new TourExecutionConflictError("Started tour could not be confirmed");
      }
      return active;
    },
  };
}
