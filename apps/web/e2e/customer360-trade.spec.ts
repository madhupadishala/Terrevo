import {test,expect} from "@playwright/test";

const TENANT="d5000000-0000-4000-8000-000000000001";
const USER="d5000000-0000-4000-8000-000000000002";
const TERR="d5000000-0000-4000-8000-000000000003";
const DOC="d5000000-0000-4000-8000-000000000004";
const CHEM="d5000000-0000-4000-8000-000000000005";
const STOCK="d5000000-0000-4000-8000-000000000006";
const PRODUCT="d5000000-0000-4000-8000-000000000007";
const EXEC="d5000000-0000-4000-8000-000000000008";
const STOP="d5000000-0000-4000-8000-000000000009";
const VISIT="d5000000-0000-4000-8000-000000000010";
const REL1="d5000000-0000-4000-8000-000000000011";
const REL2="d5000000-0000-4000-8000-000000000012";

test("Customer 360 links Doctor to Chemist to Stockist, shows verified history, then unlocks RCPA and POB",async({page})=>{
  const relationships:any[]=[];
  const writes:Array<{path:string;body:any}>=[];
  await page.route("**/api/v1/**",async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    const json=(body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
    if(req.method()!=="GET")writes.push({path,body:req.postDataJSON?.()});
    if(path==="/api/v1/auth/login")return json({accessToken:"customer",refreshToken:"refresh",expiresIn:3600,user:{id:USER,email:null}});
    if(path==="/api/v1/platform/context")return json({isSuperAdmin:false});
    if(path==="/api/v1/tenants")return json({tenants:[{id:TENANT,name:"Customer Pharma",slug:"customer",status:"active"}]});
    if(path==="/api/v1/access-context")return json({context:{roles:[{roleKey:"MR",scopeOrgUnitId:TERR}],permissions:["MASTER_VIEW","TOUR_PLAN_OWN"],orgAssignments:[{orgUnitId:TERR,isPrimary:true}]}});
    if(path==="/api/v1/tour-executions/progress")return json({progress:{
      executionId:EXEC,workDate:"2026-10-15",territoryId:TERR,startedAt:"2026-10-15T08:00:00Z",serverNow:"2026-10-15T09:00:00Z",
      requiredMinutes:480,elapsedMinutes:60,remainingMinutes:420,plannedCount:1,completedCount:0,inProgressCount:1,pendingCount:0,
      stops:[{planStopId:STOP,sequence:1,type:"chemist",targetId:CHEM,targetName:"Central Chemist",status:"IN_PROGRESS"}]
    }});
    if(path==="/api/v1/tour-executions/start-options")return json({options:[]});
    if(path==="/api/v1/visits/open")return json({visit:{id:VISIT,executionId:EXEC,planStopId:STOP,territoryId:TERR,status:"CHECKED_IN",verification:"VERIFIED",exceptionStatus:"NOT_REQUIRED",distanceMeters:4,geofenceRadiusMeters:100,checkinAt:"2026-10-15T08:50:00Z",checkoutAt:null}});
    if(path==="/api/v1/tour-plans")return json({plans:[]});
    if(path==="/api/v1/org-units")return json({units:[{id:TERR,parentId:null,type:"territory",code:"T1",name:"Central Territory",status:"active"}]});
    if(path==="/api/v1/masters/doctors")return json({items:[{id:DOC,code:"D001",name:"Dr Rao",specialty:"Cardiology",status:"active",territoryId:TERR,address:"Clinic Road"}]});
    if(path==="/api/v1/masters/chemists")return json({items:[{id:CHEM,code:"C001",name:"Central Chemist",status:"active",territoryId:TERR,address:"Market Road"}]});
    if(path==="/api/v1/masters/stockists")return json({items:[{id:STOCK,code:"S001",name:"Metro Stockist",status:"active",territoryId:TERR,address:"Depot Road"}]});
    if(path==="/api/v1/masters/products")return json({items:[{id:PRODUCT,code:"P001",name:"Terrevo Product",status:"active",divisionId:TERR}]});
    if(path.startsWith("/api/v1/masters/"))return json({items:[]});
    if(path==="/api/v1/nca/options")return json({options:{categories:[],towns:[]}});
    if(path==="/api/v1/nca/own")return json({records:[]});
    if(path==="/api/v1/unplanned-calls/own")return json({calls:[]});
    if(path==="/api/v1/dcrs")return json({dcrs:[]});
    if(path==="/api/v1/attendance")return json({attendance:[]});
    if(path==="/api/v1/customer-relationships"&&req.method()==="GET")return json({relationships});
    if(path==="/api/v1/customer-relationships"&&req.method()==="POST"){
      const b=req.postDataJSON();
      const relationship={id:relationships.length?REL2:REL1,tenantId:TENANT,...b,relationship:b.sourceKind==="doctor"?"DOCTOR_CHEMIST":"CHEMIST_STOCKIST",createdAt:"2026-10-15T09:00:00Z"};
      relationships.push(relationship);return json({relationship},201);
    }
    if(path==="/api/v1/customer-history"){
      const kind=url.searchParams.get("kind"),id=url.searchParams.get("id");
      if(kind==="doctor"&&id===DOC)return json({history:[{tenantId:TENANT,customerKind:"doctor",customerId:DOC,id:"h1",occurredAt:"2026-10-15T08:00:00Z",activityType:"DCR",summary:"Doctor call · Detailed"}]});
      if(kind==="chemist"&&id===CHEM)return json({history:[{tenantId:TENANT,customerKind:"chemist",customerId:CHEM,id:"h2",occurredAt:"2026-10-14T08:00:00Z",activityType:"RCPA",summary:"RCPA captured for linked chemist"}]});
      return json({history:[]});
    }
    if(path==="/api/v1/visits/"+VISIT+"/rcpa"&&req.method()==="GET")return json({error:"Not found"},404);
    if(path==="/api/v1/visits/"+VISIT+"/order"&&req.method()==="GET")return json({error:"Not found"},404);
    if(path==="/api/v1/visits/"+VISIT+"/rcpa"&&req.method()==="PUT")return json({rcpa:{id:"r1",visitId:VISIT,chemistId:CHEM,updatedAt:"2026-10-15T09:05:00Z",lines:req.postDataJSON().lines}});
    if(path==="/api/v1/visits/"+VISIT+"/order"&&req.method()==="PUT")return json({order:{id:"o1",visitId:VISIT,customerType:"chemist",customerId:CHEM,customerCode:"C001",customerName:"Central Chemist",status:"BOOKED",updatedAt:"2026-10-15T09:06:00Z",lines:req.postDataJSON().lines}});
    return json({error:"Unexpected "+req.method()+" "+path},404);
  });

  await page.goto("/?auth-test=1");
  await page.locator("#account-email").fill("mr@example.invalid");
  await page.locator("#account-password").fill("pw");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();

  await page.getByRole("button",{name:"Customer 360",exact:true}).click();
  await page.getByRole("button",{name:"View doctor Dr Rao"}).click();
  await expect(page.getByText("Doctor call · Detailed")).toBeVisible();
  await page.getByLabel("Link chemist").selectOption(CHEM);
  await page.getByRole("button",{name:"Link outlet"}).click();
  await expect(page.getByText("Central Chemist",{exact:true}).last()).toBeVisible();

  await page.getByRole("button",{name:"View chemist Central Chemist"}).click();
  await expect(page.getByText("RCPA captured for linked chemist")).toBeVisible();
  await page.getByLabel("Link stockist").selectOption(STOCK);
  await page.getByRole("button",{name:"Link outlet"}).click();
  await expect(page.getByText("Metro Stockist",{exact:true}).last()).toBeVisible();

  await page.getByRole("button",{name:"RCPA & orders"}).click();
  await expect(page.getByText("Doctor → Chemist link for RCPA")).toBeVisible();
  await expect(page.getByText("Chemist → Stockist link for POB")).toBeVisible();
  await expect(page.getByText("LINKED",{exact:true})).toHaveCount(2);

  await page.locator("#rcpa-product").selectOption(PRODUCT);
  await page.locator("#rcpa-rx").fill("5");
  await page.getByRole("button",{name:"Save RCPA"}).click();
  await expect(page.getByText("RCPA saved",{exact:true})).toBeVisible();

  await page.locator("#order-product").selectOption(PRODUCT);
  await page.locator("#order-quantity").fill("3");
  await page.getByRole("button",{name:"Book POB"}).click();
  await expect(page.getByText("POB recorded",{exact:true})).toBeVisible();

  expect(writes.filter(x=>x.path==="/api/v1/customer-relationships")).toHaveLength(2);
  expect(writes.some(x=>x.path==="/api/v1/visits/"+VISIT+"/rcpa")).toBe(true);
  expect(writes.some(x=>x.path==="/api/v1/visits/"+VISIT+"/order")).toBe(true);
});
