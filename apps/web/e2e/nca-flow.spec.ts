import {test,expect} from "@playwright/test";

const TENANT="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const TERRITORY="33333333-3333-4333-8333-333333333333";
const TOWN="44444444-4444-4444-8444-444444444444";
const RECORD="55555555-5555-4555-8555-555555555555";

test("tenant-admin configures NCA master, field user saves draft, and submission persists",async({page})=>{
  let categories:Array<{code:string;label:string;active:boolean}>=[];
  let towns:Array<{id:string;territoryId:string;name:string;active:boolean}>=[];
  let records:Array<Record<string,unknown>>=[];
  const savedBodies:Array<Record<string,unknown>>=[];
  await page.route("**/api/v1/**",async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,tenant=request.headers()["x-tenant-id"];
    const respond=(payload:unknown,status=200)=>route.fulfill({status,body:JSON.stringify(payload),contentType:"application/json"});
    if(path==="/api/v1/auth/login")return respond({accessToken:"test",refreshToken:"refresh",expiresIn:3600,user:{id:USER,email:null}});
    if(path==="/api/v1/platform/context")return respond({isSuperAdmin:false});
    if(path==="/api/v1/tenants")return respond({tenants:[{id:TENANT,name:"Test pharma company",slug:"test-pharma",status:"active"}]});
    if(tenant!==TENANT)return respond({error:"Missing tenant scope"},403);
    if(path==="/api/v1/access-context")return respond({context:{roles:[{roleKey:"TENANT_ADMIN",scopeOrgUnitId:null}],permissions:["MASTER_MANAGE","TOUR_PLAN_OWN"],orgAssignments:[]}});
    if(path==="/api/v1/tour-executions/progress")return respond({progress:null});
    if(path==="/api/v1/tour-executions/start-options")return respond({options:[]});
    if(path==="/api/v1/visits/open")return respond({visit:null});
    if(path==="/api/v1/tour-plans")return respond({plans:[]});
    if(path==="/api/v1/org-units")return respond({units:[{id:TERRITORY,type:"territory",code:"CENTRAL",name:"Central",status:"active",parentId:null}]});
    if(path.startsWith("/api/v1/masters/"))return respond({items:[]});
    if(path==="/api/v1/nca/options")return respond({options:{categories,towns}});
    if(path==="/api/v1/nca/own")return respond({records});
    if(path==="/api/v1/nca/categories"&&request.method()==="POST"){
      const {code,label}=request.postDataJSON();categories=[{code,label,active:true}];return respond({category:{code,label,active:true}},201);
    }
    if(path==="/api/v1/nca/towns"&&request.method()==="POST"){
      const {territoryId,name}=request.postDataJSON();towns=[{id:TOWN,territoryId,name,active:true}];
      return respond({town:{territoryId,name}},201);
    }
    if(path==="/api/v1/nca"&&request.method()==="POST"){
      const body=request.postDataJSON();savedBodies.push(body);
      records=[{id:RECORD,...body,createdAt:"2026-10-11T12:00:00Z",status:"DRAFT"}];
      return respond({record:records[0]},201);
    }
    if(path==="/api/v1/nca/"+RECORD+"/submit"&&request.method()==="POST"){
      records=[{...records[0],status:"SUBMITTED"}];return respond({record:records[0]});
    }
    if(path==="/api/v1/manager/command-center")return respond({commandCenter:{teamMembers:1,activeTours:0,submittedToursToday:0,pending:{tourApprovals:0,gpsExceptions:0,weeklyTimesheets:0,leaves:0,expenses:0},localDate:"2026-10-11"}});
    if(path==="/api/v1/tour-approvals")return respond({plans:[]});
    if(path.startsWith("/api/v1/manager/analytics"))return respond({analytics:{tours:{submitted:0},coverage:{plannedStops:0,completedVisits:0,doctorCalls:0}}});
    return respond({error:"Unexpected route "+path},404);
  });
  await page.goto("/");
  await page.locator("#account-email").fill("user@example.invalid");
  await page.locator("#account-password").fill("pass");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.getByRole("button",{name:"Organization admin",exact:true}).click();
  await page.locator("#nca-master-code").fill("TEAM_MEETING");
  await page.locator("#nca-master-label").fill("Team meeting");
  await page.getByRole("button",{name:"Save category"}).click();
  await expect(page.getByText("1 approved NCA categories")).toBeVisible();
  await page.locator("#nca-town-territory").selectOption(TERRITORY);
  await page.locator("#nca-town-name").fill("Central Town");
  await page.getByRole("button",{name:"Save town"}).click();
  await expect(page.getByText("1 authorized towns")).toBeVisible();

  await page.getByRole("button",{name:"NCA & activities",exact:true}).click();
  await page.locator("#activity-kind").selectOption("NON_CALL_ACTIVITY");
  await page.locator("#activity-date").fill("2026-10-11");
  await page.locator("#activity-territory").selectOption(TERRITORY);
  await page.locator("#activity-phase").selectOption("PLAN");
  await page.locator("#activity-subtype").selectOption("TEAM_MEETING");
  await page.locator("#activity-town").selectOption(TOWN);
  await page.locator("#activity-reason").fill("Quarterly team review");
  await page.locator("#activity-duration").fill("45");
  await page.getByRole("button",{name:"Review activity draft"}).click();
  await expect(page.getByText("No record has been saved on a server.")).toBeVisible();
  await page.getByRole("button",{name:"Save NCA draft"}).click();
  await expect(page.getByText("NCA draft saved by the Terrevo API")).toBeVisible();
  expect(savedBodies).toHaveLength(1);
  expect(savedBodies[0]).toMatchObject({phase:"PLAN",categoryCode:"TEAM_MEETING",townId:TOWN,territoryId:TERRITORY});
  await expect(page.getByRole("button",{name:"Submit NCA"})).toBeVisible();
  await page.getByRole("button",{name:"Submit NCA"}).click();
  await expect(page.getByText("SUBMITTED",{exact:true})).toBeVisible();
  expect(records[0].status).toBe("SUBMITTED");
});
