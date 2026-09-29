export type DailyTimesheet = {
  id: string;
  executionId: string;
  workDate: string;
  startedAt: string;
  submittedAt: string;
  totalMinutes: number;
  visitMinutes: number;
  unclassifiedMinutes: number;
  callCount: number;
  status: "GENERATED" | "REVIEWED";
  remarks: string | null;
  reviewedAt: string | null;
};

export type DailyTimesheetRepository = {
  listOwn(tenantId: string, accessToken: string): Promise<DailyTimesheet[]>;
  getOwn(tenantId: string, timesheetId: string, accessToken: string): Promise<DailyTimesheet | null>;
  review(
    tenantId: string,
    userId: string,
    timesheetId: string,
    input: { operationId: string; remarks: string | null },
  ): Promise<void>;
};

export class DailyTimesheetInputError extends Error {}
export class DailyTimesheetNotFoundError extends Error {}
export class DailyTimesheetConflictError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value:unknown,field:string):string{
  if(typeof value!=="string"||!UUID.test(value))throw new DailyTimesheetInputError(`${field} must be a UUID`);
  return value;
}
function remarks(value:unknown):string|null{
  if(value==null||value==="")return null;
  if(typeof value!=="string")throw new DailyTimesheetInputError("Invalid remarks");
  const result=value.trim();
  if(!result||result.length>1000)throw new DailyTimesheetInputError("Invalid remarks");
  return result;
}

export function createDailyTimesheetService(repository:DailyTimesheetRepository){
  return {
    list(tenantId:string,accessToken:string){return repository.listOwn(tenantId,accessToken)},
    async get(tenantId:string,accessToken:string,timesheetIdValue:unknown){
      const id=uuid(timesheetIdValue,"timesheetId");
      const row=await repository.getOwn(tenantId,id,accessToken);
      if(!row)throw new DailyTimesheetNotFoundError("Daily timesheet not found");
      return row;
    },
    async review(
      tenantId:string,userId:string,accessToken:string,timesheetIdValue:unknown,value:Record<string,unknown>
    ){
      const id=uuid(timesheetIdValue,"timesheetId");
      await repository.review(tenantId,userId,id,{
        operationId:uuid(value.operationId,"operationId"),
        remarks:remarks(value.remarks),
      });
      const row=await repository.getOwn(tenantId,id,accessToken);
      if(!row||row.status!=="REVIEWED")throw new DailyTimesheetConflictError("Reviewed timesheet could not be confirmed");
      return row;
    },
  };
}
