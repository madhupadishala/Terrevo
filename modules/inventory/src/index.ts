import type { MastersRepository } from "../../masters/src/index.ts";
import type { RbacService } from "../../rbac/src/index.ts";

export const INVENTORY_ITEM_TYPES=["sample","gift"] as const;
export type InventoryItemType=typeof INVENTORY_ITEM_TYPES[number];

export type InventoryBalance={
  id:string;
  employeeId:string;
  itemType:InventoryItemType;
  itemId:string;
  quantity:number;
};

export type DistributionLine={
  itemType:InventoryItemType;
  itemId:string;
  quantity:number;
};

export type VisitDistribution=DistributionLine & {
  id:string;
  visitId:string;
  createdAt:string;
};

export type InventoryRepository={
  listBalances(tenantId:string,accessToken:string):Promise<InventoryBalance[]>;
  issue(
    tenantId:string,actorUserId:string,input:{
      operationId:string;employeeId:string;itemType:InventoryItemType;itemId:string;quantity:number;
    }
  ):Promise<void>;
  returnOwn(
    tenantId:string,userId:string,input:{
      operationId:string;itemType:InventoryItemType;itemId:string;quantity:number;
    }
  ):Promise<void>;
  distribute(
    tenantId:string,userId:string,visitId:string,input:{
      operationId:string;items:DistributionLine[];
    }
  ):Promise<void>;
  listVisitDistributions(tenantId:string,visitId:string,accessToken:string):Promise<VisitDistribution[]>;
};

export class InventoryInputError extends Error {}
export class InventoryNotFoundError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value:unknown,field:string):string{
  if(typeof value!=="string"||!UUID.test(value))throw new InventoryInputError(`${field} must be a UUID`);
  return value;
}
function itemType(value:unknown):InventoryItemType{
  if(typeof value!=="string"||!INVENTORY_ITEM_TYPES.includes(value as InventoryItemType))throw new InventoryInputError("Invalid itemType");
  return value as InventoryItemType;
}
function quantity(value:unknown):number{
  if(!Number.isInteger(value)||(value as number)<1||(value as number)>100000)throw new InventoryInputError("quantity must be an integer from 1 to 100000");
  return value as number;
}
function parseLine(raw:unknown,index:number):DistributionLine{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new InventoryInputError(`Invalid distribution item at index ${index}`);
  const value=raw as Record<string,unknown>;
  return {itemType:itemType(value.itemType),itemId:uuid(value.itemId,"itemId"),quantity:quantity(value.quantity)};
}
function parseLines(value:unknown):DistributionLine[]{
  if(!Array.isArray(value)||value.length<1||value.length>20)throw new InventoryInputError("items must contain 1 to 20 entries");
  const keys=new Set<string>();
  const lines=value.map(parseLine);
  for(const line of lines){
    const key=`${line.itemType}:${line.itemId}`;
    if(keys.has(key))throw new InventoryInputError("Duplicate sample/gift in one distribution");
    keys.add(key);
  }
  return lines.sort((a,b)=>`${a.itemType}:${a.itemId}`.localeCompare(`${b.itemType}:${b.itemId}`));
}

export function createInventoryService(
  repository:InventoryRepository,masters:MastersRepository,rbac:RbacService
){
  return {
    listBalances(tenantId:string,accessToken:string){
      return repository.listBalances(tenantId,accessToken);
    },

    async issue(
      tenantId:string,actorUserId:string,accessToken:string,value:Record<string,unknown>
    ){
      const operationId=uuid(value.operationId,"operationId");
      const employeeId=uuid(value.employeeId,"employeeId");
      const type=itemType(value.itemType);
      const itemId=uuid(value.itemId,"itemId");
      const amount=quantity(value.quantity);

      const [employee,item]=await Promise.all([
        masters.get("employees",tenantId,employeeId,accessToken),
        masters.get(type==="sample"?"samples":"gifts",tenantId,itemId,accessToken),
      ]);
      if(!employee)throw new InventoryNotFoundError("Employee not found or outside scope");
      if(!item)throw new InventoryNotFoundError("Sample/gift not found or outside scope");
      if(typeof employee.orgUnitId!=="string")throw new InventoryInputError("Employee organization scope is invalid");

      await rbac.authorize(tenantId,"INVENTORY_MANAGE",employee.orgUnitId,accessToken);
      await repository.issue(tenantId,actorUserId,{operationId,employeeId,itemType:type,itemId,quantity:amount});
    },

    async returnOwn(tenantId:string,userId:string,value:Record<string,unknown>){
      await repository.returnOwn(tenantId,userId,{
        operationId:uuid(value.operationId,"operationId"),
        itemType:itemType(value.itemType),
        itemId:uuid(value.itemId,"itemId"),
        quantity:quantity(value.quantity),
      });
    },

    async distribute(
      tenantId:string,userId:string,accessToken:string,visitIdValue:unknown,value:Record<string,unknown>
    ){
      const visitId=uuid(visitIdValue,"visitId");
      const items=parseLines(value.items);
      await repository.distribute(tenantId,userId,visitId,{
        operationId:uuid(value.operationId,"operationId"),
        items,
      });
      return repository.listVisitDistributions(tenantId,visitId,accessToken);
    },

    async listVisitDistributions(tenantId:string,accessToken:string,visitIdValue:unknown){
      const visitId=uuid(visitIdValue,"visitId");
      return repository.listVisitDistributions(tenantId,visitId,accessToken);
    },
  };
}
