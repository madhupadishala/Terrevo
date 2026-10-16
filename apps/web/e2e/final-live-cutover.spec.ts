import {test,expect,type Page,type Route} from "@playwright/test";

const TENANT="a1000000-0000-4000-8000-000000000001";
const USER="a1000000-0000-4000-8000-000000000002";
const TERRITORY="a1000000-0000-4000-8000-000000000003";
const COMPANY="a1000000-0000-4000-8000-000000000005";
const MANAGER_EMP="a1000000-0000-4000-8000-000000000004";

type BaselineOptions={platformAdmin?:boolean;permissions?:string[];refreshOnce?:boolean};
async function installBaseline(page:Page,opts:BaselineOptions={}){
 let refreshed=false;let platformTenants:any[]=[];let units:any[]=[{id:COMPANY,parentId:null,type:"company",code:"QA-PHARMA",name:"QA Pharma",status:"active"},{id:TERRITORY,parentId:COMPANY,type:"territory",code:"HYD-C",name:"Hyderabad Central Territory",status:"active"}];
 let employees:any[]=[{id:MANAGER_EMP,code:"MGR-01",name:"Meera Sharma",designation:"Manager",status:"active",orgUnitId:TERRITORY}];
 const mutations:Array<{path:string;body:any;auth?:string}>=[];
 await page.route("**/api/v1/**",async(route:Route)=>{
  const req=route.request(),path=new URL(req.url()).pathname,method=req.method(),auth=req.headers()["authorization"];
  const json=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  if(method!=="GET")mutations.push({path,body:req.postDataJSON?.(),auth});
  if(path==="/api/v1/auth/login")return json({accessToken:"old-token",refreshToken:"refresh-1",expiresIn:1,user:{id:USER,email:"admin@example.invalid"}});
  if(path==="/api/v1/auth/refresh"){refreshed=true;return json({accessToken:"new-token",refreshToken:"refresh-2",expiresIn:3600,user:{id:USER,email:"admin@example.invalid"}})}
  if(path==="/api/v1/auth/logout")return route.fulfill({status:204,body:""});
  if(path==="/api/v1/platform/context")return json({isSuperAdmin:Boolean(opts.platformAdmin)});
  if(path==="/api/v1/tenants")return json({tenants:opts.platformAdmin?[]:[{id:TENANT,name:"QA Pharma Live",slug:"qa-pharma-live",status:"active"}]});
  if(path==="/api/v1/platform/tenants"&&method==="GET")return json({tenants:platformTenants});
  if(path==="/api/v1/platform/tenants"&&method==="POST"){const b=req.postDataJSON() as any;const t={id:TENANT,name:b.name,slug:b.slug,status:"active"};platformTenants=[t];return json({tenant:t},201)}
  if(path==="/api/v1/platform/audit")return json({events:[]});
  if(path===`/api/v1/platform/tenants/${TENANT}/users`&&method==="POST"){const b=req.postDataJSON() as any;return json({user:{userId:crypto.randomUUID(),email:b.email,role:"TENANT_ADMIN",orgUnitId:null}},201)}
  if(path==="/api/v1/access-context"){
   if(opts.refreshOnce&&!refreshed)return json({error:"expired"},401);
   return json({context:{roles:[{roleKey:"TENANT_ADMIN",scopeOrgUnitId:null}],permissions:opts.permissions??["ORG_MANAGE","RBAC_MANAGE","MASTER_VIEW"],orgAssignments:[{orgUnitId:TERRITORY,isPrimary:true}]}});
  }
  if(path==="/api/v1/org-units"&&method==="GET")return json({units});
  if(path==="/api/v1/org-units"&&method==="POST"){
   const b=req.postDataJSON() as any;const row={id:"a1000000-0000-4000-8000-000000000099",parentId:b.parentId??null,type:b.type,code:b.code,name:b.name,status:"active"};units=[...units,row];return json({unit:row},201);
  }
  if(path==="/api/v1/users/provision"&&method==="POST"){
   const b=req.postDataJSON() as any;
   if(b.role==="MANAGER")employees=[...employees,{id:"a1000000-0000-4000-8000-000000000088",code:b.employeeCode,name:b.name,designation:"Manager",status:"active",orgUnitId:b.orgUnitId}];
   return json({user:{userId:crypto.randomUUID(),email:b.email,role:b.role,orgUnitId:b.orgUnitId}},201);
  }
  if(path==="/api/v1/tour-executions/progress")return json({progress:null});
  if(path==="/api/v1/tour-executions/start-options")return json({options:[]});
  if(path==="/api/v1/visits/open")return json({visit:null});
  if(path==="/api/v1/tour-plans")return json({plans:[]});
  if(path==="/api/v1/masters/employees")return json({items:employees});
  if(path.startsWith("/api/v1/masters/"))return json({items:[]});
  if(path==="/api/v1/clm/assets")return json({assets:[]});
  if(path==="/api/v1/customer-relationships")return json({relationships:[]});
  if(path==="/api/v1/nca/options")return json({options:{categories:[],towns:[]}});
  if(path==="/api/v1/nca/own")return json({records:[]});
  if(path==="/api/v1/attendance")return json({attendance:[]});
  if(path==="/api/v1/leaves/own")return json({leaves:[]});
  if(path==="/api/v1/expenses/own")return json({claims:[]});
  if(path==="/api/v1/timesheets/weekly/own")return json({timesheets:[]});
  if(path==="/api/v1/dcrs")return json({dcrs:[]});
  if(path==="/api/v1/inventory")return json({balances:[]});
  if(path==="/api/v1/manager/command-center")return json({commandCenter:{teamMembers:1,activeTours:0,submittedToursToday:0,shortDaysToday:0,activeJointWork:0,pending:{tourApprovals:0,gpsExceptions:0,weeklyTimesheets:0,leaves:0,expenses:0}}});
  if(path==="/api/v1/tour-approvals")return json({plans:[]});
  if(path==="/api/v1/visit-exceptions")return json({exceptions:[]});
  if(path==="/api/v1/nca-approvals")return json({records:[]});
  if(path==="/api/v1/expense-approvals")return json({claims:[]});
  if(path==="/api/v1/leave-approvals")return json({leaves:[]});
  return json({error:"Unhandled "+method+" "+path},404);
 });
 return{mutations,get refreshed(){return refreshed}};
}

test("default production shell refreshes an expired session and logs out cleanly",async({page})=>{
 const state=await installBaseline(page,{refreshOnce:true});
 await page.goto("/");
 await expect(page.getByTestId("live-login")).toBeVisible();
 await page.getByTestId("live-email").fill("admin@example.invalid");
 await page.getByTestId("live-password").fill("Temporary!123");
 await page.getByTestId("live-login-submit").click();
 await expect(page.getByTestId("live-session-bar")).toBeVisible();
 await expect(page.getByText("LIVE DATA PROVIDER",{exact:true})).toBeVisible();
 expect(state.refreshed).toBe(true);
 const refreshMutation=state.mutations.find(x=>x.path==="/api/v1/auth/refresh");
 expect(refreshMutation).toBeTruthy();
 await page.getByTestId("live-logout").click();
 await expect(page.getByTestId("live-login")).toBeVisible();
});

test("tenant admin creates hierarchy and provisions scoped Manager then MR through live provider",async({page})=>{
 const state=await installBaseline(page);
 await page.goto("/");
 await page.getByTestId("live-email").fill("admin@example.invalid");
 await page.getByTestId("live-password").fill("Temporary!123");
 await page.getByTestId("live-login-submit").click();
 await page.getByTestId("nav-admin").click();
 await expect(page.getByTestId("live-org-admin")).toBeVisible();

 await page.getByTestId("live-unit-type").selectOption("division");
 await page.getByTestId("live-unit-parent").selectOption(COMPANY);
 await page.getByTestId("live-unit-code").fill("DIV-HYD");
 await page.getByTestId("live-unit-name").fill("Hyderabad Division");
 await page.getByTestId("live-unit-create").click();
 await expect(page.getByText("Organization unit created")).toBeVisible();

 await page.getByTestId("provision-name").fill("Regional Manager");
 await page.getByTestId("provision-email").fill("manager@example.invalid");
 await page.getByTestId("provision-code").fill("MGR-02");
 await page.getByTestId("provision-role").selectOption("MANAGER");
 await page.getByTestId("provision-org").selectOption(TERRITORY);
 await page.getByTestId("provision-user").click();
 await expect(page.getByText("User provisioned")).toBeVisible();

 await page.getByTestId("provision-name").fill("Medical Representative");
 await page.getByTestId("provision-email").fill("mr@example.invalid");
 await page.getByTestId("provision-code").fill("MR-02");
 await page.getByTestId("provision-role").selectOption("MR");
 await page.getByTestId("provision-org").selectOption(TERRITORY);
 await page.getByTestId("provision-manager").selectOption("a1000000-0000-4000-8000-000000000088");
 await page.getByTestId("provision-user").click();
 await expect(page.getByText("User provisioned")).toBeVisible();

 const provision=state.mutations.filter(x=>x.path==="/api/v1/users/provision").map(x=>x.body);
 expect(provision).toHaveLength(2);
 expect(provision[0]).toMatchObject({role:"MANAGER",orgUnitId:TERRITORY});
 expect(provision[1]).toMatchObject({role:"MR",orgUnitId:TERRITORY,reportingManagerEmployeeId:"a1000000-0000-4000-8000-000000000088"});
});


test("platform Super Admin creates a tenant and provisions the initial Tenant Admin in the default live shell",async({page})=>{
 const state=await installBaseline(page,{platformAdmin:true});
 await page.goto("/");
 await page.getByTestId("live-email").fill("superadmin@example.invalid");
 await page.getByTestId("live-password").fill("Temporary!123");
 await page.getByTestId("live-login-submit").click();
 await expect(page.getByTestId("live-session-bar")).toBeVisible();
 await page.getByTestId("nav-platform").click();
 await expect(page.getByTestId("live-platform-admin")).toBeVisible();
 await page.getByTestId("live-tenant-name").fill("New Pharma");
 await page.getByTestId("live-tenant-slug").fill("new-pharma");
 await page.getByTestId("live-tenant-create").click();
 await expect(page.getByText("Organization created")).toBeVisible();
 await page.getByTestId("tenant-admin-name").fill("Tenant Administrator");
 await page.getByTestId("tenant-admin-email").fill("tenant-admin@example.invalid");
 await page.getByTestId("tenant-admin-provision").click();
 await expect(page.getByText("Tenant administrator provisioned")).toBeVisible();
 const create=state.mutations.find(x=>x.path==="/api/v1/platform/tenants");
 const provision=state.mutations.find(x=>x.path===`/api/v1/platform/tenants/${TENANT}/users`);
 expect(create?.body).toMatchObject({name:"New Pharma",slug:"new-pharma"});
 expect(provision?.body).toMatchObject({email:"tenant-admin@example.invalid",role:"TENANT_ADMIN"});
});
