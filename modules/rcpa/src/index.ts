export type RcpaLine={
  sequence:number;
  productId:string|null;
  competitorBrand:string|null;
  prescriptionCount:number;
  stockQuantity:number;
  salesQuantity:number;
};
export type RcpaReport={id:string;visitId:string;chemistId:string;lines:RcpaLine[];updatedAt:string};
export type RcpaRepository={
  save(tenantId:string,userId:string,visitId:string,input:{operationId:string;lines:RcpaLine[]}):Promise<string>;
  getByVisit(tenantId:string,visitId:string,accessToken:string):Promise<RcpaReport|null>;
};
export class RcpaInputError extends Error{}
export class RcpaNotFoundError extends Error{}
export class RcpaConflictError extends Error{}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(v:unknown,f:string){if(typeof v!=="string"||!UUID.test(v))throw new RcpaInputError(`${f} must be a UUID`);return v}
function qty(v:unknown,f:string){if(!Number.isInteger(v)||(v as number)<0||(v as number)>1000000)throw new RcpaInputError(`Invalid ${f}`);return v as number}
function brand(v:unknown):string|null{if(v==null||v==="")return null;if(typeof v!=="string")throw new RcpaInputError("Invalid competitorBrand");const s=v.trim();if(!s||s.length>160)throw new RcpaInputError("Invalid competitorBrand");return s}
function lines(v:unknown):RcpaLine[]{
 if(!Array.isArray(v)||v.length<1||v.length>50)throw new RcpaInputError("lines must contain 1 to 50 entries");
 const seen=new Set<string>();
 return v.map((raw,i)=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new RcpaInputError(`Invalid line ${i}`);
  const x=raw as Record<string,unknown>;if(!Number.isInteger(x.sequence)||(x.sequence as number)<1)throw new RcpaInputError("Invalid sequence");
  const productId=x.productId==null?null:uuid(x.productId,"productId");const competitorBrand=brand(x.competitorBrand);
  if((productId==null)===(competitorBrand==null))throw new RcpaInputError("Each line requires exactly one productId or competitorBrand");
  const key=productId?`product:${productId}`:`competitor:${competitorBrand!.toLowerCase()}`;if(seen.has(key))throw new RcpaInputError("Duplicate RCPA item");seen.add(key);
  const prescriptionCount=qty(x.prescriptionCount??0,"prescriptionCount"),stockQuantity=qty(x.stockQuantity??0,"stockQuantity"),salesQuantity=qty(x.salesQuantity??0,"salesQuantity");
  if(prescriptionCount+stockQuantity+salesQuantity===0)throw new RcpaInputError("RCPA line must contain an observed quantity");
  return{sequence:x.sequence as number,productId,competitorBrand,prescriptionCount,stockQuantity,salesQuantity};
 }).sort((a,b)=>a.sequence-b.sequence);
}
export function createRcpaService(repository:RcpaRepository){
 return{
  async save(t:string,u:string,token:string,visitValue:unknown,value:Record<string,unknown>){
   const visitId=uuid(visitValue,"visitId");const id=await repository.save(t,u,visitId,{operationId:uuid(value.operationId,"operationId"),lines:lines(value.lines)});
   const row=await repository.getByVisit(t,visitId,token);if(!row||row.id!==id)throw new RcpaConflictError("RCPA could not be confirmed");return row;
  },
  async get(t:string,token:string,visitValue:unknown){const row=await repository.getByVisit(t,uuid(visitValue,"visitId"),token);if(!row)throw new RcpaNotFoundError("RCPA not found");return row;}
 };
}
