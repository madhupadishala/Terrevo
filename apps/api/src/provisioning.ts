import type {SupabaseConfig} from "./supabase-adapter.ts";
import {ProviderError} from "./supabase-adapter.ts";

export type ProvisionRole="TENANT_ADMIN"|"MANAGER"|"MR";
export class ProvisioningInputError extends Error{}
export class ProvisioningConflictError extends Error{}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function email(v:unknown){if(typeof v!=="string"||!v.trim().includes("@"))throw new ProvisioningInputError("Valid email is required");return v.trim().toLowerCase()}
function password(v:unknown){if(typeof v!=="string"||v.length<10)throw new ProvisioningInputError("Temporary password must be at least 10 characters");return v}
function text(v:unknown,name:string,min=1,max=160){if(typeof v!=="string"||v.trim().length<min||v.trim().length>max)throw new ProvisioningInputError(name+" is invalid");return v.trim()}
function role(v:unknown):ProvisionRole{if(v!=="TENANT_ADMIN"&&v!=="MANAGER"&&v!=="MR")throw new ProvisioningInputError("Invalid role");return v}

export function createProvisioningService(config:SupabaseConfig,fetcher:typeof fetch=fetch){
 const root=config.url.replace(/\/+$/,"");
 if(!config.serviceRoleKey)throw new ProviderError("Server provider key is not configured",500);
 const headers={"apikey":config.serviceRoleKey,"authorization":"Bearer "+config.serviceRoleKey,"content-type":"application/json"};
 async function call(url:string,init:RequestInit){
  const r=await fetcher(url,{...init,headers:{...headers,...(init.headers||{})}});
  if(!r.ok){
   const body=await r.text().catch(()=>"");
   if(r.status===409||body.toLowerCase().includes("already"))throw new ProvisioningConflictError("User or employee already exists");
   throw new ProviderError("Provisioning provider operation failed",r.status);
  }
  return r.status===204?null:r.json();
 }
 async function deleteAuthUser(id:string){await fetcher(root+"/auth/v1/admin/users/"+encodeURIComponent(id),{method:"DELETE",headers}).catch(()=>undefined)}
 return{
  async provision(tenantId:string,value:Record<string,unknown>){
   if(!UUID.test(tenantId))throw new ProvisioningInputError("Invalid tenant");
   const userEmail=email(value.email),tempPassword=password(value.temporaryPassword),userRole=role(value.role);
   const name=text(value.name,"Name",2,160);
   const code=userRole==="TENANT_ADMIN"?null:text(value.employeeCode,"Employee code",2,64);
   const orgUnitId=userRole==="TENANT_ADMIN"?null:(typeof value.orgUnitId==="string"&&UUID.test(value.orgUnitId)?value.orgUnitId:(()=>{throw new ProvisioningInputError("Organization scope is required")})());
   const managerEmployeeId=value.reportingManagerEmployeeId==null?null:(typeof value.reportingManagerEmployeeId==="string"&&UUID.test(value.reportingManagerEmployeeId)?value.reportingManagerEmployeeId:(()=>{throw new ProvisioningInputError("Invalid reporting manager")})());

   const auth=await call(root+"/auth/v1/admin/users",{method:"POST",body:JSON.stringify({email:userEmail,password:tempPassword,email_confirm:true,user_metadata:{name}})}) as {id:string};
   const userId=auth.id;
   try{
    await call(root+"/rest/v1/tenant_memberships",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({tenant_id:tenantId,user_id:userId,status:"active"})});
    await call(root+"/rest/v1/user_role_assignments",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({tenant_id:tenantId,user_id:userId,role_key:userRole,scope_org_unit_id:orgUnitId,status:"active"})});
    if(orgUnitId){
     await call(root+"/rest/v1/rpc/admin_assign_user_org",{method:"POST",body:JSON.stringify({p_tenant_id:tenantId,p_user_id:userId,p_org_unit_id:orgUnitId,p_is_primary:true})});
     await call(root+"/rest/v1/employees",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify({
      tenant_id:tenantId,user_id:userId,code,name,designation:userRole==="MANAGER"?"Manager":"Medical Representative",
      org_unit_id:orgUnitId,reporting_manager_employee_id:managerEmployeeId,status:"active",
     })});
    }
    return{userId,email:userEmail,role:userRole,orgUnitId};
   }catch(error){
    await deleteAuthUser(userId);
    throw error;
   }
  },
 };
}
