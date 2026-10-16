import {test,expect} from "@playwright/test";

test("production default authenticates, hydrates live provider, preserves tenant session and logs out",async({page})=>{
 const tenant="e1000000-0000-4000-8000-000000000001",territory="e1000000-0000-4000-8000-000000000002",user="e1000000-0000-4000-8000-000000000003";
 let loginCalls=0;
 await page.route("**/api/v1/**",async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const json=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  if(path==="/api/v1/auth/login"){loginCalls++;return json({accessToken:"live-token",refreshToken:"refresh-token",expiresIn:3600,user:{id:user,email:"mr@qa.invalid"}})}
  if(path==="/api/v1/auth/logout")return route.fulfill({status:204,body:""});
  if(path==="/api/v1/platform/context")return json({isSuperAdmin:false});
  if(path==="/api/v1/tenants")return json({tenants:[{id:tenant,name:"Live Pharma",slug:"live-pharma",status:"active"}]});
  if(path==="/api/v1/access-context")return json({context:{roles:[{roleKey:"MR",scopeOrgUnitId:territory}],permissions:["TOUR_PLAN_OWN","MASTER_VIEW"],orgAssignments:[{orgUnitId:territory,isPrimary:true}]}});
  if(path==="/api/v1/org-units")return json({units:[{id:territory,parentId:null,type:"territory",code:"HYD",name:"Hyderabad Central",status:"active"}]});
  if(path.startsWith("/api/v1/masters/"))return json({items:[]});
  if(path==="/api/v1/tour-plans")return json({plans:[]});
  if(path==="/api/v1/tour-executions/progress")return json({progress:null});
  if(path==="/api/v1/visits/open")return json({visit:null});
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
  if(path==="/api/v1/tour-executions/start-options")return json({options:[]});
  return json({error:"Unexpected "+req.method()+" "+path},404);
 });
 await page.goto("/");
 await expect(page.getByTestId("live-login")).toBeVisible();
 await expect(page.getByTestId("qa-scenario-toggle")).toHaveCount(0);
 await page.getByTestId("live-email").fill("mr@qa.invalid");
 await page.getByTestId("live-password").fill("Password!123");
 await page.getByTestId("live-login-submit").click();
 await expect(page.getByTestId("live-session-bar")).toBeVisible();
 await expect(page.getByTestId("live-tenant-select")).toHaveValue(tenant);
 await expect(page.getByText("LIVE DATA PROVIDER",{exact:true})).toBeVisible();
 await expect(page.getByText("Live Pharma",{exact:true}).first()).toBeVisible();
 expect(loginCalls).toBe(1);
 await page.reload();
 await expect(page.getByTestId("live-session-bar")).toBeVisible();
 await page.getByTestId("live-logout").click();
 await expect(page.getByTestId("live-login")).toBeVisible();
});
