import {test,expect} from "@playwright/test";

const TENANT="11000000-0000-4000-8000-000000000001";
const USER="11000000-0000-4000-8000-000000000002";
const TERR="11000000-0000-4000-8000-000000000003";
const PLAN="11000000-0000-4000-8000-000000000004";
const DAY="11000000-0000-4000-8000-000000000005";
const STOP="11000000-0000-4000-8000-000000000006";
const DOC="11000000-0000-4000-8000-000000000007";
const EXEC="11000000-0000-4000-8000-000000000008";
const VISIT="11000000-0000-4000-8000-000000000009";
const DCR="11000000-0000-4000-8000-000000000010";
const WORK_DATE="2026-10-15";

test("approved DTP drives Start My Day, agenda, planned call, automatic DCR and End My Day",async({page,context})=>{
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({latitude:17.385,longitude:78.4867,accuracy:12});
  let active=false,checkedIn=false,callSaved=false,completed=false,submitted=false;
  const writes:Array<{path:string;body:any}>=[];

  await page.route("**/api/v1/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const json=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
    if(req.method()!=="GET")writes.push({path,body:req.postDataJSON?.()});
    if(path==="/api/v1/auth/login")return json({accessToken:"field",refreshToken:"refresh",expiresIn:3600,user:{id:USER,email:null}});
    if(path==="/api/v1/platform/context")return json({isSuperAdmin:false});
    if(path==="/api/v1/tenants")return json({tenants:[{id:TENANT,name:"Execution Pharma",slug:"execution",status:"active"}]});
    if(path==="/api/v1/access-context")return json({context:{roles:[{roleKey:"MR",scopeOrgUnitId:TERR}],permissions:["TOUR_PLAN_OWN"],orgAssignments:[{orgUnitId:TERR,isPrimary:true}]}});
    if(path==="/api/v1/tour-executions/start-options")return json({options:(!active&&!submitted)?[{planId:PLAN,planDayId:DAY,workDate:WORK_DATE,territoryId:TERR}]:[]});
    if(path==="/api/v1/tour-executions/progress")return json({progress:active&&!submitted?{
      executionId:EXEC,workDate:WORK_DATE,territoryId:TERR,startedAt:"2026-10-15T08:00:00Z",serverNow:"2026-10-15T08:10:00Z",
      requiredMinutes:480,elapsedMinutes:10,remainingMinutes:470,plannedCount:1,completedCount:completed?1:0,
      inProgressCount:checkedIn?1:0,pendingCount:completed?0:checkedIn?0:1,
      stops:[{planStopId:STOP,sequence:1,type:"doctor",targetId:DOC,targetName:"Dr Field",status:completed?"COMPLETED":checkedIn?"IN_PROGRESS":"PENDING"}]
    }:null});
    if(path==="/api/v1/visits/open")return json({visit:checkedIn?{id:VISIT,executionId:EXEC,planStopId:STOP,territoryId:TERR,status:"CHECKED_IN",verification:"VERIFIED",exceptionStatus:"NOT_REQUIRED",distanceMeters:5,geofenceRadiusMeters:100,checkinAt:"2026-10-15T08:10:00Z",checkoutAt:null}:null});
    if(path==="/api/v1/tour-plans"&&req.method()==="GET")return json({plans:[{id:PLAN,weekStart:"2026-10-12",status:"APPROVED",submittedAt:"2026-10-14T10:00:00Z"}]});
    if(path==="/api/v1/tour-plans/"+PLAN&&req.method()==="GET")return json({plan:{id:PLAN,weekStart:"2026-10-12",status:"APPROVED",submittedAt:"2026-10-14T10:00:00Z",days:[{date:WORK_DATE,territoryId:TERR,remarks:"Approved day",stops:[{sequence:1,type:"doctor",targetId:DOC,remarks:"Priority doctor"}]}]}});
    if(path==="/api/v1/org-units")return json({units:[{id:TERR,parentId:null,type:"territory",code:"FIELD",name:"Field Territory",status:"active"}]});
    if(path==="/api/v1/masters/doctors")return json({items:[{id:DOC,code:"D001",name:"Dr Field",status:"active",territoryId:TERR}]});
    if(path.startsWith("/api/v1/masters/"))return json({items:[]});
    if(path==="/api/v1/nca/options")return json({options:{categories:[{code:"MEETING",label:"Team meeting",active:true}],towns:[]}});
    if(path==="/api/v1/nca/own")return json({records:[]});
    if(path==="/api/v1/unplanned-calls/own")return json({calls:[]});
    if(path==="/api/v1/dcrs")return json({dcrs:completed?[{id:DCR,doctorName:"Dr Field",doctorCode:"D001",callOutcome:"Detailed",submittedAt:"2026-10-15T08:30:00Z",doctorId:DOC}]:[]});
    if(path==="/api/v1/attendance")return json({attendance:active||submitted?[{workDate:WORK_DATE,status:submitted?"SUBMITTED":"PRESENT",workedMinutes:submitted?10:null,requiredMinutes:480}]:[]});

    if(path==="/api/v1/tour-executions/start"&&req.method()==="POST"){active=true;return json({execution:{id:EXEC}},201);}
    if(path==="/api/v1/visits/check-in"&&req.method()==="POST"){checkedIn=true;return json({visit:{id:VISIT}},201);}
    if(path==="/api/v1/visits/"+VISIT+"/doctor-call"&&req.method()==="PUT"){callSaved=true;return json({doctorCall:{id:"call-1"}},200);}
    if(path==="/api/v1/visits/"+VISIT+"/check-out"&&req.method()==="POST"){
      if(!callSaved)return json({error:"Doctor call required"},409);
      checkedIn=false;completed=true;return json({visit:{id:VISIT,status:"CHECKED_OUT"}},200);
    }
    if(path==="/api/v1/tour-executions/submit"&&req.method()==="POST"){active=false;submitted=true;return json({execution:{id:EXEC,status:"SUBMITTED"}},200);}
    return json({error:"Unexpected "+req.method()+" "+path},404);
  });

  await page.goto("/?auth-test=1");
  await page.locator("#account-email").fill("field@example.invalid");
  await page.locator("#account-password").fill("pw");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.getByRole("button",{name:"Field execution",exact:true}).click();

  await expect(page.getByRole("heading",{name:"Start My Day"})).toBeVisible();
  await expect(page.locator("#approved-day")).toHaveValue(DAY);
  await expect(page.getByLabel("Approved DTP preview")).toContainText("Dr Field");
  await page.getByRole("button",{name:"Start My Day (GPS)"}).click();
  await expect(page.getByText("Workday started",{exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Today's execution queue"})).toBeVisible();
  await expect(page.getByText("Dr Field",{exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Add unplanned call"}).click();
  await expect(page.locator("#activity-kind")).toHaveValue("UNPLANNED_CALL");
  await expect(page.locator("#activity-date")).toHaveValue(WORK_DATE);
  await expect(page.locator("#activity-territory")).toHaveValue(TERR);
  await page.getByRole("button",{name:"Field execution",exact:true}).click();

  await page.locator("#stop-select").selectOption(STOP);
  await page.getByRole("button",{name:"Check in using device GPS"}).click();
  await expect(page.getByText("Field check-in saved")).toBeVisible();
  await page.locator("#call-outcome").fill("Detailed");
  await page.locator("#call-remarks").fill("Discussed priority product");
  await page.getByRole("button",{name:"Save call outcome"}).click();
  await expect(page.getByText("Call outcome saved")).toBeVisible();
  await page.getByRole("button",{name:"Check out with location"}).click();
  await expect(page.getByText("Checked out; DCR generated")).toBeVisible();
  await expect(page.getByRole("heading",{name:"DCR evidence"})).toBeVisible();
  await expect(page.getByText("D001 · Detailed",{exact:false})).toBeVisible();

  await expect(page.getByRole("button",{name:"End My Day"})).toBeDisabled();
  await page.locator("#short-reason").fill("Field day intentionally closed early for controlled acceptance");
  await expect(page.getByRole("button",{name:"End My Day"})).toBeEnabled();
  await page.getByRole("button",{name:"End My Day"}).click();
  await expect(page.getByText("Workday submitted",{exact:true})).toBeVisible();

  expect(writes.map(x=>x.path)).toContain("/api/v1/tour-executions/start");
  expect(writes.map(x=>x.path)).toContain("/api/v1/visits/check-in");
  expect(writes.map(x=>x.path)).toContain("/api/v1/visits/"+VISIT+"/doctor-call");
  expect(writes.map(x=>x.path)).toContain("/api/v1/visits/"+VISIT+"/check-out");
  expect(writes.map(x=>x.path)).toContain("/api/v1/tour-executions/submit");
  const submit=writes.find(x=>x.path==="/api/v1/tour-executions/submit");
  expect(submit?.body.shortDayReason).toContain("controlled acceptance");
});

test("manager command shows live field execution and submitted-day visibility without field mutation controls",async({page})=>{
  const MANAGER="22000000-0000-4000-8000-000000000001";
  await page.route("**/api/v1/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const json=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
    if(path==="/api/v1/auth/login")return json({accessToken:"manager",refreshToken:"refresh",expiresIn:3600,user:{id:MANAGER,email:null}});
    if(path==="/api/v1/platform/context")return json({isSuperAdmin:false});
    if(path==="/api/v1/tenants")return json({tenants:[{id:TENANT,name:"Execution Pharma",slug:"execution",status:"active"}]});
    if(path==="/api/v1/access-context")return json({context:{roles:[{roleKey:"MANAGER",scopeOrgUnitId:TERR}],permissions:["TOUR_VIEW_TEAM","TOUR_APPROVE"],orgAssignments:[{orgUnitId:TERR,isPrimary:true}]}});
    if(path==="/api/v1/tour-executions/progress")return json({progress:null});
    if(path==="/api/v1/tour-executions/start-options")return json({options:[]});
    if(path==="/api/v1/visits/open")return json({visit:null});
    if(path==="/api/v1/tour-plans"||path==="/api/v1/tour-approvals")return json({plans:[]});
    if(path==="/api/v1/org-units")return json({units:[{id:TERR,parentId:null,type:"territory",code:"FIELD",name:"Field Territory",status:"active"}]});
    if(path.startsWith("/api/v1/masters/"))return json({items:[]});
    if(path==="/api/v1/nca/options")return json({options:{categories:[],towns:[]}});
    if(path==="/api/v1/nca/own")return json({records:[]});
    if(path==="/api/v1/unplanned-calls/own")return json({calls:[]});
    if(path==="/api/v1/dcrs")return json({dcrs:[]});
    if(path==="/api/v1/attendance")return json({attendance:[]});
    if(path==="/api/v1/unplanned-approvals")return json({calls:[]});
    if(path==="/api/v1/manager/command-center")return json({commandCenter:{serverNow:"2026-10-15T10:00:00Z",localDate:WORK_DATE,teamMembers:6,activeTours:3,submittedToursToday:2,shortDaysToday:1,activeJointWork:0,pending:{tourApprovals:0,gpsExceptions:0,weeklyTimesheets:0,leaves:0,expenses:0},queues:{tourApprovals:[],gpsExceptions:[],weeklyTimesheets:[],leaves:[],expenses:[]}}});
    if(path==="/api/v1/manager/analytics")return json({analytics:{period:{days:7,startDate:"2026-10-09",endDate:WORK_DATE},tours:{submitted:10,totalWorkedMinutes:4200},coverage:{plannedStops:40,completedVisits:32,doctorCalls:25,chemistCalls:5,stockistCalls:2}}});
    return json({error:"Unexpected "+path},404);
  });
  await page.goto("/?auth-test=1");
  await page.locator("#account-email").fill("manager@example.invalid");
  await page.locator("#account-password").fill("pw");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.getByRole("button",{name:"Manager command"}).click();
  await expect(page.getByText("3",{exact:true}).first()).toBeVisible();
  await expect(page.getByText("2",{exact:true}).first()).toBeVisible();
  await expect(page.getByText("32",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Start My Day (GPS)"})).toHaveCount(0);
});
