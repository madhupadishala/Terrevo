export type TradeCall = {
  id: string;
  visitId: string;
  callType: "chemist" | "stockist";
  outcome: string;
  remarks: string | null;
  nextAction: string | null;
  updatedAt: string;
};

export type TradeCallRepository = {
  save(
    tenantId:string,userId:string,visitId:string,
    input:{operationId:string;outcome:string;remarks:string|null;nextAction:string|null}
  ):Promise<string>;
  getByVisit(tenantId:string,visitId:string,accessToken:string):Promise<TradeCall|null>;
};

export class TradeCallInputError extends Error {}
export class TradeCallNotFoundError extends Error {}
export class TradeCallConflictError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value:unknown,field:string){if(typeof value!=="string"||!UUID.test(value))throw new TradeCallInputError(`${field} must be a UUID`);return value}
function text(value:unknown,field:string,max:number,nullable=false):string|null{
  if(value==null||value===""){if(nullable)return null;throw new TradeCallInputError(`${field} is required`)}
  if(typeof value!=="string")throw new TradeCallInputError(`Invalid ${field}`);
  const result=value.trim();if(!result||result.length>max)throw new TradeCallInputError(`Invalid ${field}`);return result;
}

export function createTradeCallService(repository:TradeCallRepository){
  return {
    async save(tenantId:string,userId:string,accessToken:string,visitIdValue:unknown,value:Record<string,unknown>){
      const visitId=uuid(visitIdValue,"visitId");
      const id=await repository.save(tenantId,userId,visitId,{
        operationId:uuid(value.operationId,"operationId"),
        outcome:text(value.outcome,"outcome",120)!,
        remarks:text(value.remarks,"remarks",2000,true),
        nextAction:text(value.nextAction,"nextAction",1000,true),
      });
      const row=await repository.getByVisit(tenantId,visitId,accessToken);
      if(!row||row.id!==id)throw new TradeCallConflictError("Trade call could not be confirmed");
      return row;
    },
    async get(tenantId:string,accessToken:string,visitIdValue:unknown){
      const row=await repository.getByVisit(tenantId,uuid(visitIdValue,"visitId"),accessToken);
      if(!row)throw new TradeCallNotFoundError("Trade call not found");
      return row;
    },
  };
}
