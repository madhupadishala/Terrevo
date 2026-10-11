import {test,expect} from "@playwright/test";
const TENANT="11111111-1111-4111-8111-111111111111",MR="22222222-2222-4222-8222-222222222222";
const MANAGER="33333333-3333-4333-8333-333333333333",TERR="44444444-4444-4444-8444-444444444444";
const CUST="55555555-5555-4555-8555-555555555555",EX="66666666-6666-4666-8666-666666666666";
const STOP="77777777-7777-4777-8777-777777777777",CALL="88888888-8888-4888-8888-888888888888";
const workDate="2026-10-11";
const baseProgress={executionId:EX,workDate,territoryId:TERR,startedAt:"2026-10-11T06:00:00Z",
 serverNow:"2026-10-11T08:00:00Z",requiredMinutes:480,elapsedMinutes:120,remainingMinutes:360,
 plannedCount:1,completedCount:0,inProgressCount:0,pendingCount:1,
 stops:[{planStopId:STOP,sequence:1,type:"doctor",targetId:CUST,targetName:"Dr Example",status:"PENDING"}]};
const master={id:CUST,name:"Dr Example",code:"D001",status:"active",territoryId:TERR};
function mockApi(page:any,asManager=false){
 let call:Record<string,any>|null=null,submittedBody:Record<string,any>|null=null,approved=false;
 return {bind:async()=>{
   await page.route("**/api/v1/**",async(route:any)=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const reply=(data:unknown,status=200)=>route.fulfill({status,body:JSON.stringify(data),contentType:"application/json"});
    if(path==="/api/v1/auth/login")return reply({accessToken:"test",refreshToken:"refresh",expiresIn:3600,user:{id:asManager?MANAGER:MR,email:"tester@example.invalid"}});
    if(path==="/api/v1/platform/context")return reply({isSuperAdmin:false});
    if(path==="/api/v1/tenants")return reply({tenants:[{id:TENANT,name:"Controlled Organization",slug:"controlled",status:"active"}]});
    if(req.headers()["x-tenant-id"]!==TENANT)return reply({error:"Missing tenant"},403);
    if(path==="/api/v1/access-context")return reply({context:{roles:[{roleKey:asManager?"MANAGER":"MR",scopeOrgUnitId:TERR}],
     permissions:["TOUR_PLAN_OWN",...(asManager?["TOUR_APPROVE","TOUR_VIEW_TEAM"]:[])],orgAssignments:[{orgUnitId:TERR,isPrimary:true}]}});
    if(path==="/api/v1/tour-executions/progress")return reply({progress:asManager?null:baseProgress});
    if(path==="/api/v1/tour-executions/start-options")return reply({options:[]});
    if(path==="/api/v1/visits/open")return reply({visit:null});
    if(path==="/api/v1/tour-plans")return reply({plans:[]});
    if(path==="/api/v1/org-units")return reply({units:[{id:TERR,parentId:null,type:"territory",code:"T1",name:"Central",status:"active"}]});
    if(path==="/api/v1/masters/doctors")return reply({items:[master]});
    if(path.startsWith("/api/v1/masters/"))return reply({items:[]});
    if(path==="/api/v1/nca/options")return reply({options:{categories:[],towns:[]}});
    if(path==="/api/v1/nca/own")return reply({records:[]});
    if(path==="/api/v1/unplanned-calls/own")return reply({calls:call?[call]:[]});
    if(path==="/api/v1/unplanned-calls"&&req.method()==="POST"){
      submittedBody=req.postDataJSON();
      call={...submittedBody,id:CALL,actorUserId:MR,workDate,status:"SUBMITTED",managerComment:null,
        submittedAt:"2026-10-11T08:30:00Z",reviewedAt:null};
      return reply({call},201);
    }
    if(path==="/api/v1/unplanned-approvals"&&req.method()==="GET")return reply({calls:asManager?[call??{id:CALL,actorUserId:MR,executionId:EX,workDate,territoryId:TERR,customerType:"doctor",customerId:CUST,
      reason:"Urgent customer visit",remarks:"Spoke with doctor",durationMinutes:25,latitude:17.38,longitude:78.48,
      accuracyMeters:15,status:approved?"APPROVED":"SUBMITTED",submittedAt:"2026-10-11T08:30:00Z",managerComment:null}].filter(c=>c.status==="SUBMITTED"):[]});
    if(path==="/api/v1/unplanned-approvals/"+CALL+"/decision"&&req.method()==="POST"){
      const body=req.postDataJSON();approved=body.decision==="APPROVE";
      call={id:CALL,actorUserId:MR,executionId:EX,workDate,territoryId:TERR,customerType:"doctor",customerId:CUST,
      reason:"Urgent customer visit",remarks:"Spoke with doctor",durationMinutes:25,latitude:17.38,longitude:78.48,
      accuracyMeters:15,status:approved?"APPROVED":"REJECTED",submittedAt:"2026-10-11T08:30:00Z",reviewedAt:"2026-10-11T09:00:00Z",managerComment:body.comment??null};
      return reply({call});
    }
    if(path==="/api/v1/tour-approvals")return reply({plans:[]});
    if(path==="/api/v1/manager/command-center")return reply({commandCenter:{teamMembers:1,activeTours:1,submittedToursToday:0,pending:{tourApprovals:0,gpsExceptions:0,weeklyTimesheets:0,leaves:0,expenses:0}}});
    if(path.includes("/analytics"))return reply({analytics:null});
    return reply({error:"Missing mock route "+path},404);
   });
 },state:()=>({submittedBody,approved})};
}
test("planned call opens existing authorized tour stop without creating an unplanned write",async({page})=>{
 const fixture=mockApi(page);await fixture.bind();
 await page.goto("/");await page.locator("#account-email").fill("mr@example.invalid");
 await page.locator("#account-password").fill("password");
 await page.getByRole("button",{name:"Connect to live workflows"}).click();
 await page.getByRole("button",{name:"NCA & activities"}).click();
 await page.locator("#activity-date").fill(workDate);
 await page.locator("#activity-territory").selectOption(TERR);
 await page.locator("#activity-stop").selectOption(STOP);
 await page.getByRole("button",{name:"Open approved planned stop"}).click();
 await expect(page.locator("#stop-select")).toHaveValue(STOP);
 expect(fixture.state().submittedBody).toBeNull();
});
test("unplanned doctor call submits actual GPS and appears in own history",async({page,context})=>{
 await context.grantPermissions(["geolocation"]);await context.setGeolocation({latitude:17.38,longitude:78.48,accuracy:15});
 const fixture=mockApi(page);await fixture.bind();
 await page.goto("/");await page.locator("#account-email").fill("mr@example.invalid");
 await page.locator("#account-password").fill("password");
 await page.getByRole("button",{name:"Connect to live workflows"}).click();
 await page.getByRole("button",{name:"NCA & activities"}).click();
 await page.locator("#activity-kind").selectOption("UNPLANNED_CALL");
 await page.locator("#activity-date").fill(workDate);
 await page.locator("#activity-territory").selectOption(TERR);
 await page.locator("#activity-customer-type").selectOption("doctor");
 await page.locator("#activity-customer").selectOption(CUST);
 await page.locator("#activity-reason").fill("Urgent customer visit");
 await page.locator("#activity-duration").fill("25");
 await page.locator("#activity-remarks").fill("Spoke with doctor");
 await page.getByRole("button",{name:"Review activity draft"}).click();
 await page.getByRole("button",{name:"Submit unplanned call for review"}).click();
 await expect(page.getByText("Unplanned call submitted to the manager review queue.")).toBeVisible();
 expect(fixture.state().submittedBody).toMatchObject({executionId:EX,territoryId:TERR,
   customerType:"doctor",customerId:CUST,latitude:17.38,longitude:78.48});
 await expect(page.getByRole("heading",{name:"Submitted calls and manager decisions"})).toBeVisible();
});
test("manager reviews submitted unplanned call using distinct approval API",async({page})=>{
 const fixture=mockApi(page,true);await fixture.bind();
 await page.goto("/");await page.locator("#account-email").fill("manager@example.invalid");
 await page.locator("#account-password").fill("password");
 await page.getByRole("button",{name:"Connect to live workflows"}).click();
 await page.getByRole("button",{name:"Manager command"}).click();
 await expect(page.getByRole("heading",{name:"Unplanned customer-call review"})).toBeVisible();
 await page.getByRole("button",{name:"Approve",exact:true}).first().click();
 await expect(page.getByText("Unplanned call approved")).toBeVisible();
 expect(fixture.state().approved).toBe(true);
});
