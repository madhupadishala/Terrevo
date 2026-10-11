import type { RbacService } from "../../rbac/src/index.ts";

export type NcaPhase = "PLAN" | "REPORT";
export type NcaCategory = { code: string; label: string; active: boolean };
export type NcaTown = { id: string; name: string; territoryId: string; active: boolean };
export type NcaOptions = { categories: NcaCategory[]; towns: NcaTown[] };
export type NcaRecord = {
  id: string; workDate: string; territoryId: string; phase: NcaPhase;
  categoryCode: string; townId: string | null; reason: string; remarks: string;
  durationMinutes: number; status: "DRAFT" | "SUBMITTED"; createdAt: string;
};
export type NcaCommand = {
  operationId: string; workDate: string; territoryId: string; phase: NcaPhase;
  categoryCode: string; townId: string | null; reason: string; remarks: string;
  durationMinutes: number;
};
export type NcaRepository = {
  options(tenantId:string,accessToken:string):Promise<NcaOptions>;
  listOwn(tenantId:string,userId:string,accessToken:string):Promise<NcaRecord[]>;
  getOwn(tenantId:string,userId:string,id:string,accessToken:string):Promise<NcaRecord|null>;
  create(tenantId:string,userId:string,command:NcaCommand):Promise<string>;
  submit(tenantId:string,userId:string,id:string):Promise<void>;
  createCategory(tenantId:string,actorId:string,code:string,label:string):Promise<void>;
  createTown(tenantId:string,actorId:string,territoryId:string,name:string):Promise<void>;
};
export class NcaInputError extends Error {}
export class NcaConflictError extends Error {}
export class NcaNotFoundError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
function uuid(value:unknown,field:string):string {
  if(typeof value!=="string"||!UUID.test(value)) throw new NcaInputError(field+" must be UUID");
  return value;
}
function workDate(value:unknown):string {
  if(typeof value!=="string"||!ISO_DATE.test(value)) throw new NcaInputError("Valid workDate is required");
  const date=new Date(value+"T00:00:00Z");
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)throw new NcaInputError("Invalid workDate");
  return value;
}
function short(value:unknown,field:string,max:number,required=true):string {
  if(value===null||value===undefined||value==="") {
    if(required) throw new NcaInputError(field+" required");
    return "";
  }
  if(typeof value!=="string"||!value.trim()||value.trim().length>max) throw new NcaInputError("Invalid "+field);
  return value.trim();
}

export function createNcaService(repo:NcaRepository,rbac:RbacService) {
  return {
    async options(t:string,token:string):Promise<NcaOptions> {
      const options=await repo.options(t,token);
      const eligible=await Promise.all(options.towns.map(async town=>{
        try {await rbac.authorize(t,"TOUR_PLAN_OWN",town.territoryId,token);return town;} catch{return null;}
      }));
      return {categories:options.categories.filter(x=>x.active),towns:eligible.filter((x):x is NcaTown=>x!==null&&x.active)};
    },
    async listOwn(t:string,u:string,token:string) { return repo.listOwn(t,u,token); },
    async save(t:string,u:string,token:string,raw:Record<string,unknown>):Promise<NcaRecord> {
      const phase=raw.phase;
      if(phase!=="PLAN"&&phase!=="REPORT") throw new NcaInputError("Select NCA planning or reporting");
      const command:NcaCommand={
        operationId:uuid(raw.operationId,"operationId"),
        workDate:workDate(raw.workDate),
        territoryId:uuid(raw.territoryId,"territoryId"),
        phase,
        categoryCode:short(raw.categoryCode,"categoryCode",40),
        townId:raw.townId==null||raw.townId===""?null:uuid(raw.townId,"townId"),
        reason:short(raw.reason,"reason",500),
        remarks:short(raw.remarks,"remarks",2000,phase==="REPORT"),
        durationMinutes:Number(raw.durationMinutes),
      };
      if(!Number.isInteger(command.durationMinutes)||command.durationMinutes<1||command.durationMinutes>1440)throw new NcaInputError("durationMinutes must be 1 to 1440");
      if(command.phase==="PLAN"&&!command.townId)throw new NcaInputError("An authorized town is required for planned NCA");
      await rbac.authorize(t,"TOUR_PLAN_OWN",command.territoryId,token);
      const options=await repo.options(t,token);
      if(!options.categories.some(x=>x.active&&x.code===command.categoryCode)) throw new NcaInputError("Unapproved NCA category");
      if(command.townId&&!options.towns.some(x=>x.active&&x.id===command.townId&&x.territoryId===command.territoryId))throw new NcaInputError("Town must belong to the selected territory");
      const id=await repo.create(t,u,command);
      const saved=await repo.getOwn(t,u,id,token);
      if(!saved) throw new NcaConflictError("NCA draft was not readable after creation");
      return saved;
    },
    async submit(t:string,u:string,token:string,idInput:unknown):Promise<NcaRecord> {
      const id=uuid(idInput,"ncaId");
      const row=await repo.getOwn(t,u,id,token);
      if(!row)throw new NcaNotFoundError("NCA draft not found");
      if(row.status!=="DRAFT")throw new NcaConflictError("Only draft NCA records can be submitted");
      await rbac.authorize(t,"TOUR_PLAN_OWN",row.territoryId,token);
      await repo.submit(t,u,id);
      const saved=await repo.getOwn(t,u,id,token);
      if(!saved||saved.status!=="SUBMITTED")throw new NcaConflictError("NCA submission could not be confirmed");
      return saved;
    },
    async configureCategory(t:string,actor:string,token:string,raw:Record<string,unknown>){
      const code=short(raw.code,"code",40),label=short(raw.label,"label",120);
      if(!/^[A-Z][A-Z0-9_]{1,39}$/.test(code))throw new NcaInputError("NCA category code must use uppercase letters, digits and underscores");
      await rbac.authorize(t,"MASTER_MANAGE",null,token);
      await repo.createCategory(t,actor,code,label);
      return {code,label,active:true};
    },
    async configureTown(t:string,actor:string,token:string,raw:Record<string,unknown>){
      const territoryId=uuid(raw.territoryId,"territoryId"),name=short(raw.name,"name",120);
      await rbac.authorize(t,"MASTER_MANAGE",null,token);
      await repo.createTown(t,actor,territoryId,name);
      return {territoryId,name};
    },
  };
}
