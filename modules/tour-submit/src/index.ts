export type SubmitTourResult = {
  id: string;
  status: "SUBMITTED";
  startedAt: string;
  submittedAt: string;
  requiredMinutes: number;
  workedMinutes: number;
  shortDayReason: string | null;
};

export type SubmitTourRepository = {
  submit(
    tenantId: string,
    userId: string,
    input: { operationId: string; shortDayReason: string | null },
  ): Promise<string>;
  getSubmitted(tenantId: string, executionId: string, accessToken: string): Promise<SubmitTourResult | null>;
};

export class SubmitTourInputError extends Error {}
export class SubmitTourConflictError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value:unknown):string{
  if(typeof value!=="string"||!UUID.test(value))throw new SubmitTourInputError("operationId must be a UUID");
  return value;
}
function reason(value:unknown):string|null{
  if(value==null||value==="")return null;
  if(typeof value!=="string")throw new SubmitTourInputError("Invalid shortDayReason");
  const result=value.trim();
  if(!result||result.length>1000)throw new SubmitTourInputError("Invalid shortDayReason");
  return result;
}

export function createSubmitTourService(repository:SubmitTourRepository){
  return {
    async submit(
      tenantId:string,userId:string,accessToken:string,value:Record<string,unknown>
    ){
      const executionId=await repository.submit(tenantId,userId,{
        operationId:uuid(value.operationId),
        shortDayReason:reason(value.shortDayReason),
      });
      const result=await repository.getSubmitted(tenantId,executionId,accessToken);
      if(!result)throw new SubmitTourConflictError("Submitted tour could not be confirmed");
      return result;
    },
  };
}
