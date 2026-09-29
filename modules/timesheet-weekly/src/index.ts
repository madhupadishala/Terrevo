import type { RbacService } from "../../rbac/src/index.ts";

export type WeeklyTimesheet = {
  id: string;
  employeeId: string;
  orgUnitId: string;
  weekStart: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
  dailyCount: number;
  totalMinutes: number;
  visitMinutes: number;
  unclassifiedMinutes: number;
  callCount: number;
  submissionComment: string | null;
  submittedAt: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
};

export type WeeklyTimesheetRepository = {
  listVisible(tenantId:string,accessToken:string):Promise<WeeklyTimesheet[]>;
  listPending(tenantId:string,accessToken:string):Promise<WeeklyTimesheet[]>;
  getVisible(tenantId:string,id:string,accessToken:string):Promise<WeeklyTimesheet|null>;
  generate(tenantId:string,userId:string,weekStart:string):Promise<string>;
  submit(
    tenantId:string,userId:string,id:string,
    input:{operationId:string;comment:string|null}
  ):Promise<void>;
  decide(
    tenantId:string,actorUserId:string,id:string,
    decision:"APPROVE"|"RETURN",comment:string|null
  ):Promise<void>;
};

export class WeeklyTimesheetInputError extends Error {}
export class WeeklyTimesheetNotFoundError extends Error {}
export class WeeklyTimesheetConflictError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;

function uuid(value:unknown,field:string):string{
  if(typeof value!=="string"||!UUID.test(value))throw new WeeklyTimesheetInputError(`${field} must be a UUID`);
  return value;
}
function weekStart(value:unknown):string{
  if(typeof value!=="string"||!DATE.test(value))throw new WeeklyTimesheetInputError("Invalid weekStart");
  const parsed=new Date(`${value}T00:00:00Z`);
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value||parsed.getUTCDay()!==1){
    throw new WeeklyTimesheetInputError("weekStart must be a valid Monday");
  }
  return value;
}
function comment(value:unknown,required=false):string|null{
  if(value==null||value===""){
    if(required)throw new WeeklyTimesheetInputError("Comment is required");
    return null;
  }
  if(typeof value!=="string")throw new WeeklyTimesheetInputError("Invalid comment");
  const result=value.trim();
  if(!result||result.length>1000)throw new WeeklyTimesheetInputError("Invalid comment");
  return result;
}

export function createWeeklyTimesheetService(repository:WeeklyTimesheetRepository,rbac:RbacService){
  return {
    list(tenantId:string,accessToken:string){return repository.listVisible(tenantId,accessToken)},
    listPending(tenantId:string,accessToken:string){return repository.listPending(tenantId,accessToken)},
    async get(tenantId:string,accessToken:string,idValue:unknown){
      const id=uuid(idValue,"timesheetId");
      const row=await repository.getVisible(tenantId,id,accessToken);
      if(!row)throw new WeeklyTimesheetNotFoundError("Weekly timesheet not found");
      return row;
    },
    async generate(tenantId:string,userId:string,accessToken:string,value:Record<string,unknown>){
      const id=await repository.generate(tenantId,userId,weekStart(value.weekStart));
      const row=await repository.getVisible(tenantId,id,accessToken);
      if(!row)throw new WeeklyTimesheetConflictError("Generated weekly timesheet could not be confirmed");
      return row;
    },
    async submit(
      tenantId:string,userId:string,accessToken:string,idValue:unknown,value:Record<string,unknown>
    ){
      const id=uuid(idValue,"timesheetId");
      await repository.submit(tenantId,userId,id,{
        operationId:uuid(value.operationId,"operationId"),
        comment:comment(value.comment),
      });
      const row=await repository.getVisible(tenantId,id,accessToken);
      if(!row||row.status!=="SUBMITTED")throw new WeeklyTimesheetConflictError("Submitted weekly timesheet could not be confirmed");
      return row;
    },
    async decide(
      tenantId:string,actorUserId:string,accessToken:string,idValue:unknown,value:Record<string,unknown>
    ){
      const id=uuid(idValue,"timesheetId");
      const row=await repository.getVisible(tenantId,id,accessToken);
      if(!row)throw new WeeklyTimesheetNotFoundError("Weekly timesheet not found");
      if(row.status!=="SUBMITTED")throw new WeeklyTimesheetConflictError("Only submitted weekly timesheets can be reviewed");
      if(value.decision!=="APPROVE"&&value.decision!=="RETURN")throw new WeeklyTimesheetInputError("Invalid decision");
      const reviewComment=comment(value.comment,value.decision==="RETURN");
      await rbac.authorize(tenantId,"TIMESHEET_APPROVE",row.orgUnitId,accessToken);
      await repository.decide(tenantId,actorUserId,id,value.decision,reviewComment);
    },
  };
}
