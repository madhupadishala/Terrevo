import test from"node:test";import assert from"node:assert/strict";
import{createProvisioningService,ProvisioningInputError}from"../src/provisioning.ts";

const tenant="11111111-1111-4111-8111-111111111111";
const org="22222222-2222-4222-8222-222222222222";
const user="33333333-3333-4333-8333-333333333333";

test("provisioning rejects weak input before provider calls",async()=>{
 let calls=0;
 const service=createProvisioningService({url:"https://example.supabase.co",anonKey:"anon",serviceRoleKey:"service"},async()=>{calls++;return new Response("{}",{status:200})});
 await assert.rejects(service.provision(tenant,{email:"bad",temporaryPassword:"short",name:"A",role:"MR",employeeCode:"E",orgUnitId:org}),ProvisioningInputError);
 assert.equal(calls,0);
});

test("provisioning creates auth identity and tenant records without exposing password",async()=>{
 const calls:Array<{url:string;body:string|null}>=[];
 const service=createProvisioningService({url:"https://example.supabase.co",anonKey:"anon",serviceRoleKey:"service"},async(input,init)=>{
  const url=String(input),body=typeof init?.body==="string"?init.body:null;calls.push({url,body});
  if(url.endsWith("/auth/v1/admin/users")&&init?.method==="POST")return new Response(JSON.stringify({id:user}),{status:200});
  return new Response("",{status:204});
 });
 const result=await service.provision(tenant,{email:"mr@example.invalid",temporaryPassword:"Temporary!123",name:"Test MR",role:"MR",employeeCode:"MR-01",orgUnitId:org});
 assert.equal(result.userId,user);assert.equal(result.role,"MR");
 assert.equal(calls.filter(x=>x.url.endsWith("/auth/v1/admin/users")).length,1);
 assert.ok(calls.some(x=>x.url.includes("/tenant_memberships")));
 assert.ok(calls.some(x=>x.url.includes("/user_role_assignments")));
 assert.ok(calls.some(x=>x.url.includes("/rpc/admin_assign_user_org")));
 assert.ok(calls.some(x=>x.url.includes("/employees")));
 const serialized=JSON.stringify(result);assert.equal(serialized.includes("Temporary!123"),false);
});

test("provisioning compensates by deleting auth identity when tenant persistence fails",async()=>{
 const calls:string[]=[];
 const service=createProvisioningService({url:"https://example.supabase.co",anonKey:"anon",serviceRoleKey:"service"},async(input,init)=>{
  const url=String(input);calls.push((init?.method??"GET")+" "+url);
  if(url.endsWith("/auth/v1/admin/users")&&init?.method==="POST")return new Response(JSON.stringify({id:user}),{status:200});
  if(url.includes("/tenant_memberships"))return new Response(JSON.stringify({message:"write failed"}),{status:500});
  if(url.endsWith("/auth/v1/admin/users/"+user)&&init?.method==="DELETE")return new Response("",{status:204});
  return new Response("",{status:204});
 });
 await assert.rejects(service.provision(tenant,{email:"mr@example.invalid",temporaryPassword:"Temporary!123",name:"Test MR",role:"MR",employeeCode:"MR-01",orgUnitId:org}));
 assert.ok(calls.some(x=>x.startsWith("DELETE ")&&x.endsWith("/auth/v1/admin/users/"+user)));
});
