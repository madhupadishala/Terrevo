export type DoctorCallProduct = {
  sequence: number;
  productId: string;
  detailNotes: string | null;
};

export type DoctorCall = {
  id: string;
  visitId: string;
  doctorId: string;
  callOutcome: string;
  remarks: string | null;
  nextAction: string | null;
  products: DoctorCallProduct[];
  updatedAt: string;
};

export type DcrProduct = {
  sequence: number;
  productId: string;
  productCode: string;
  productName: string;
  detailNotes: string | null;
};

export type DcrDistribution = {
  itemType: "sample" | "gift";
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
};

export type Dcr = {
  id: string;
  visitId: string;
  executionId: string;
  doctorId: string;
  doctorCode: string;
  doctorName: string;
  status: "SUBMITTED";
  callOutcome: string;
  remarks: string | null;
  nextAction: string | null;
  callStartedAt: string;
  callEndedAt: string;
  submittedAt: string;
  gpsVerification: string;
  gpsExceptionStatus: string;
  products: DcrProduct[];
  distributions: DcrDistribution[];
};

export type DcrSummary = Omit<Dcr, "products" | "distributions">;

export type DoctorCallRepository = {
  save(
    tenantId: string,
    userId: string,
    visitId: string,
    input: {
      operationId: string;
      callOutcome: string;
      remarks: string | null;
      nextAction: string | null;
      products: DoctorCallProduct[];
    },
  ): Promise<string>;
  getByVisit(tenantId: string, visitId: string, accessToken: string): Promise<DoctorCall | null>;
  listDcrs(tenantId: string, accessToken: string): Promise<DcrSummary[]>;
  getDcr(tenantId: string, dcrId: string, accessToken: string): Promise<Dcr | null>;
};

export class DoctorCallInputError extends Error {}
export class DoctorCallConflictError extends Error {}
export class DoctorCallNotFoundError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value:unknown,field:string):string{
  if(typeof value!=="string"||!UUID.test(value))throw new DoctorCallInputError(`${field} must be a UUID`);
  return value;
}
function text(value:unknown,field:string,max:number,nullable=false):string|null{
  if(value==null||value===""){
    if(nullable)return null;
    throw new DoctorCallInputError(`${field} is required`);
  }
  if(typeof value!=="string")throw new DoctorCallInputError(`Invalid ${field}`);
  const result=value.trim();
  if(!result||result.length>max)throw new DoctorCallInputError(`Invalid ${field}`);
  return result;
}

function products(value:unknown):DoctorCallProduct[]{
  if(value==null)return[];
  if(!Array.isArray(value)||value.length>20)throw new DoctorCallInputError("products must contain at most 20 entries");
  const sequences=new Set<number>();
  const productIds=new Set<string>();
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new DoctorCallInputError(`Invalid product at index ${index}`);
    const item=raw as Record<string,unknown>;
    if(!Number.isInteger(item.sequence)||(item.sequence as number)<1)throw new DoctorCallInputError("Product sequence must be a positive integer");
    const sequence=item.sequence as number;
    if(sequences.has(sequence))throw new DoctorCallInputError("Duplicate product sequence");
    sequences.add(sequence);
    const productId=uuid(item.productId,"productId");
    if(productIds.has(productId))throw new DoctorCallInputError("Duplicate product in doctor call");
    productIds.add(productId);
    return {sequence,productId,detailNotes:text(item.detailNotes,"detailNotes",500,true)};
  }).sort((a,b)=>a.sequence-b.sequence);
}

export function createDoctorCallService(repository:DoctorCallRepository){
  return {
    async save(
      tenantId:string,userId:string,accessToken:string,visitIdValue:unknown,value:Record<string,unknown>
    ){
      const visitId=uuid(visitIdValue,"visitId");
      const input={
        operationId:uuid(value.operationId,"operationId"),
        callOutcome:text(value.callOutcome,"callOutcome",120)!,
        remarks:text(value.remarks,"remarks",2000,true),
        nextAction:text(value.nextAction,"nextAction",1000,true),
        products:products(value.products),
      };
      const callId=await repository.save(tenantId,userId,visitId,input);
      const call=await repository.getByVisit(tenantId,visitId,accessToken);
      if(!call||call.id!==callId)throw new DoctorCallConflictError("Doctor call could not be confirmed");
      return call;
    },
    async getByVisit(tenantId:string,accessToken:string,visitIdValue:unknown){
      const visitId=uuid(visitIdValue,"visitId");
      const call=await repository.getByVisit(tenantId,visitId,accessToken);
      if(!call)throw new DoctorCallNotFoundError("Doctor call not found");
      return call;
    },
    listDcrs(tenantId:string,accessToken:string){
      return repository.listDcrs(tenantId,accessToken);
    },
    async getDcr(tenantId:string,accessToken:string,dcrIdValue:unknown){
      const dcrId=uuid(dcrIdValue,"dcrId");
      const dcr=await repository.getDcr(tenantId,dcrId,accessToken);
      if(!dcr)throw new DoctorCallNotFoundError("DCR not found");
      return dcr;
    },
  };
}
