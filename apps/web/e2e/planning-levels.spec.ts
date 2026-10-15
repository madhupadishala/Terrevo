import {test,expect} from "@playwright/test";

const TENANT="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const TERRITORY="33333333-3333-4333-8333-333333333333";
const DOCTOR_A="44444444-4444-4444-8444-444444444444";
const DOCTOR_B="55555555-5555-4555-8555-555555555555";
const PLAN="66666666-6666-4666-8666-666666666666";

test("MTP WTP DTP share one persisted plan, support sequencing and submitted plans become read-only",async({page})=>{
  let status="DRAFT";
  let plan={
    id:PLAN,weekStart:"2026-10-12",status,submittedAt:null as string|null,
    days:[{date:"2026-10-15",territoryId:TERRITORY,remarks:"Core territory day",stops:[
      {sequence:1,type:"doctor",targetId:DOCTOR_A,remarks:null},
      {sequence:2,type:"doctor",targetId:DOCTOR_B,remarks:null},
    ]}]
  };
  const writes:Array<{path:string;body:any}>=[];
  await page.route("**/api/v1/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const json=(body:unknown,code=200)=>route.fulfill({status:code,contentType:"application/json",body:JSON.stringify(body)});
    if(req.method()!=="GET")writes.push({path,body:req.postDataJSON?.()});
    if(path==="/api/v1/auth/login")return json({accessToken:"planning",refreshToken:"refresh",expiresIn:3600,user:{id:USER,email:null}});
    if(path==="/api/v1/platform/context")return json({isSuperAdmin:false});
    if(path==="/api/v1/tenants")return json({tenants:[{id:TENANT,name:"Planning Pharma",slug:"planning",status:"active"}]});
    if(path==="/api/v1/access-context")return json({context:{roles:[{roleKey:"MR",scopeOrgUnitId:TERRITORY}],permissions:["TOUR_PLAN_OWN"],orgAssignments:[{orgUnitId:TERRITORY,isPrimary:true}]}});
    if(path==="/api/v1/tour-executions/progress")return json({progress:null});
    if(path==="/api/v1/tour-executions/start-options")return json({options:[]});
    if(path==="/api/v1/visits/open")return json({visit:null});
    if(path==="/api/v1/org-units")return json({units:[{id:TERRITORY,parentId:null,type:"territory",code:"CENTRAL",name:"Central Territory",status:"active"}]});
    if(path==="/api/v1/tour-plans"&&req.method()==="GET")return json({plans:[{id:PLAN,weekStart:plan.weekStart,status:plan.status,submittedAt:plan.submittedAt}]});
    if(path==="/api/v1/tour-plans/"+PLAN&&req.method()==="GET")return json({plan});
    if(path==="/api/v1/tour-plans/"+PLAN&&req.method()==="PUT"){
      const body=req.postDataJSON();plan={...plan,...body,status};return json({plan});
    }
    if(path==="/api/v1/tour-plans/"+PLAN+"/submit"&&req.method()==="POST"){
      status="SUBMITTED";plan={...plan,status,submittedAt:"2026-10-15T10:00:00Z"};return json({plan});
    }
    if(path==="/api/v1/masters/doctors")return json({items:[
      {id:DOCTOR_A,code:"D-A",name:"Doctor Alpha",status:"active",territoryId:TERRITORY},
      {id:DOCTOR_B,code:"D-B",name:"Doctor Beta",status:"active",territoryId:TERRITORY},
    ]});
    if(path.startsWith("/api/v1/masters/"))return json({items:[]});
    if(path==="/api/v1/nca/options")return json({options:{categories:[{code:"TEAM_MEETING",label:"Team meeting",active:true}],towns:[]}});
    if(path==="/api/v1/nca/own")return json({records:[]});
    if(path==="/api/v1/unplanned-calls/own")return json({calls:[]});
    return json({error:"Unexpected "+req.method()+" "+path},404);
  });

  await page.goto("/");
  await page.locator("#account-email").fill("planner@example.invalid");
  await page.locator("#account-password").fill("pw");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.getByRole("button",{name:"Tour planning"}).click();

  // MTP: month calendar, coverage and week boundary representation.
  await expect(page.getByRole("group",{name:"Monthly tour plan calendar"})).toBeVisible();
  await expect(page.getByText("1 planned days · 2 calls · 0 approved days")).toBeVisible();
  await expect(page.getByRole("button",{name:"Open week"}).first()).toBeVisible();
  await page.getByRole("button",{name:"Next month"}).click();
  await page.getByRole("button",{name:"Previous month"}).click();

  // WTP: all seven dates appear and the current planned day is represented.
  await page.getByRole("button",{name:"Weekly Tour Plan"}).click();
  await expect(page.getByRole("heading",{name:"Week of 2026-10-12"})).toBeVisible();
  for(const date of ["2026-10-12","2026-10-13","2026-10-14","2026-10-15","2026-10-16","2026-10-17","2026-10-18"]){
    await expect(page.getByText(date,{exact:true})).toBeVisible();
  }

  // DTP: open the planned day, reorder, save and confirm server payload.
  const plannedRow=page.getByText("2026-10-15",{exact:true}).locator("..").locator("..");
  await plannedRow.getByRole("button",{name:"View / plan day"}).click();
  await expect(page.getByText("Planned calls (2)")).toBeVisible();
  await page.getByRole("button",{name:"Move visit 2 earlier"}).click();
  await page.getByRole("button",{name:"Save updated weekly plan"}).click();
  await expect(page.getByText("Weekly tour plan saved")).toBeVisible();
  const update=writes.find(x=>x.path==="/api/v1/tour-plans/"+PLAN);
  expect(update).toBeTruthy();
  expect(update!.body.days[0].stops.map((x:any)=>x.targetId)).toEqual([DOCTOR_B,DOCTOR_A]);
  expect(update!.body.days[0].stops.map((x:any)=>x.sequence)).toEqual([1,2]);

  // Reload from the mocked server and verify ordering persisted.
  await page.reload();
  await page.locator("#account-email").fill("planner@example.invalid");
  await page.locator("#account-password").fill("pw");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.getByRole("button",{name:"Tour planning"}).click();
  await page.getByRole("button",{name:"Daily Tour Plan"}).click();
  await expect(page.getByText("1. Doctor Beta")).toBeVisible();
  await expect(page.getByText("2. Doctor Alpha")).toBeVisible();

  // NCA handoff keeps the date and enters the distinct controlled activity workflow.
  await page.getByRole("button",{name:"Plan NCA for this day"}).click();
  await expect(page.getByRole("heading",{name:"Planned, unplanned and non-call activity"})).toBeVisible();
  await expect(page.locator("#activity-date")).toHaveValue("2026-10-15");
  await page.locator("#activity-kind").selectOption("NON_CALL_ACTIVITY");
  await page.locator("#activity-phase").selectOption("PLAN");
  await expect(page.locator("#activity-date")).toHaveValue("2026-10-15");

  // Return to plan and submit the authoritative weekly record.
  await page.getByRole("button",{name:"Tour planning"}).click();
  await page.getByRole("button",{name:"Weekly Tour Plan"}).click();
  await page.getByRole("button",{name:"Submit weekly plan for approval"}).click();
  await expect(page.getByText("Weekly tour plan submitted for manager approval")).toBeVisible();
  await expect(page.getByText("SUBMITTED",{exact:true}).first()).toBeVisible();

  // Submitted plans are read-only in DTP.
  await page.getByRole("button",{name:"Daily Tour Plan"}).click();
  await expect(page.locator("#calendar-territory")).toBeDisabled();
  await expect(page.getByRole("button",{name:"Add planned call"})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Save updated weekly plan"})).toBeDisabled();
});
