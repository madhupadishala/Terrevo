import type { MastersRepository } from "../../masters/src/index.ts";

export type CustomerKind="doctor"|"chemist"|"stockist";
export type CustomerRelationship={
  id:string;tenantId:string;sourceKind:CustomerKind;sourceId:string;
  targetKind:CustomerKind;targetId:string;relationship:"DOCTOR_CHEMIST"|"CHEMIST_STOCKIST";
  createdAt:string;
};
export type CustomerActivity={
  tenantId:string;customerKind:CustomerKind;customerId:string;id:string;
  occurredAt:string;activityType:"DCR"|"RCPA"|"POB";summary:string;
};
export type CustomerNetworkRepository={
  listRelationships(tenantId:string,accessToken:string):Promise<CustomerRelationship[]>;
  link(tenantId:string,userId:string,sourceKind:CustomerKind,sourceId:string,targetKind:CustomerKind,targetId:string):Promise<string>;
  unlink(tenantId:string,userId:string,relationshipId:string):Promise<void>;
  history(tenantId:string,kind:CustomerKind,id:string,accessToken:string):Promise<CustomerActivity[]>;
};

export class CustomerNetworkInputError extends Error{}
export class CustomerNetworkNotFoundError extends Error{}
export class CustomerNetworkConflictError extends Error{}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(v:unknown,f:string){if(typeof v!=="string"||!UUID.test(v))throw new CustomerNetworkInputError(`${f} must be a UUID`);return v}
function kind(v:unknown,f:string):CustomerKind{
  if(v!=="doctor"&&v!=="chemist"&&v!=="stockist")throw new CustomerNetworkInputError(`Invalid ${f}`);
  return v;
}
function masterKind(v:CustomerKind){return v==="doctor"?"doctors":v==="chemist"?"chemists":"stockists" as const}

export function createCustomerNetworkService(repository:CustomerNetworkRepository,masters:MastersRepository){
  return{
    listRelationships(t:string,token:string){return repository.listRelationships(t,token);},
    async link(t:string,u:string,token:string,value:Record<string,unknown>){
      const sourceKind=kind(value.sourceKind,"sourceKind"),targetKind=kind(value.targetKind,"targetKind");
      const sourceId=uuid(value.sourceId,"sourceId"),targetId=uuid(value.targetId,"targetId");
      const allowed=(sourceKind==="doctor"&&targetKind==="chemist")||(sourceKind==="chemist"&&targetKind==="stockist");
      if(!allowed)throw new CustomerNetworkInputError("Only doctor → chemist and chemist → stockist links are allowed");
      const [source,target]=await Promise.all([
        masters.get(masterKind(sourceKind),t,sourceId,token),
        masters.get(masterKind(targetKind),t,targetId,token),
      ]);
      if(!source||!target)throw new CustomerNetworkNotFoundError("Both customers must be active and authorized");
      const id=await repository.link(t,u,sourceKind,sourceId,targetKind,targetId);
      const rows=await repository.listRelationships(t,token);
      const row=rows.find(x=>x.id===id);
      if(!row)throw new CustomerNetworkConflictError("Customer relationship could not be confirmed");
      return row;
    },
    async unlink(t:string,u:string,token:string,idValue:unknown){
      const id=uuid(idValue,"relationshipId");
      const before=(await repository.listRelationships(t,token)).find(x=>x.id===id);
      if(!before)throw new CustomerNetworkNotFoundError("Customer relationship not found");
      await repository.unlink(t,u,id);
      const after=(await repository.listRelationships(t,token)).find(x=>x.id===id);
      if(after)throw new CustomerNetworkConflictError("Customer relationship unlink could not be confirmed");
    },
    async history(t:string,token:string,kindValue:unknown,idValue:unknown){
      const k=kind(kindValue,"customerKind"),id=uuid(idValue,"customerId");
      const record=await masters.get(masterKind(k),t,id,token);
      if(!record)throw new CustomerNetworkNotFoundError("Customer not found or not authorized");
      return repository.history(t,k,id,token);
    },
  };
}
