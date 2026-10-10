import { test, expect } from "@playwright/test";

const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const USER="33333333-3333-4333-8333-333333333333";
const TERRITORY="44444444-4444-4444-8444-444444444444";
const CUSTOMER_A="55555555-5555-4555-8555-555555555555";
const CUSTOMER_B="66666666-6666-4666-8666-666666666666";

test("delegated screens render authorized records; empty NCA/CLM/AI contracts do not invent writes", async ({page})=>{
  const mutations:string[]=[];
  const customerReads: Array<string | undefined> = [];
  await page.route("**/api/v1/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname,tenant=req.headers()["x-tenant-id"];
    const reply=(data:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
    if(req.method()!=="GET") mutations.push(path);
    if(path==="/api/v1/auth/login") return reply({accessToken:"valid",refreshToken:"refresh",expiresIn:3600,user:{id:USER,email:"user@example.invalid"}});
    if(path==="/api/v1/platform/context") return reply({isSuperAdmin:false});
    if(path==="/api/v1/tenants") return reply({tenants:[
      {id:A,name:"Alpha Organization",slug:"alpha",status:"active"},
      {id:B,name:"Beta Organization",slug:"beta",status:"active"}
    ]});
    if(path==="/api/v1/access-context") return reply({context:{roles:[{roleKey:"MR",scopeOrgUnitId:TERRITORY}],permissions:[],orgAssignments:[{orgUnitId:TERRITORY,isPrimary:true}]}});
    if(path==="/api/v1/tour-executions/progress") return reply({progress:null});
    if(path==="/api/v1/tour-executions/start-options") return reply({options:[]});
    if(path==="/api/v1/visits/open") return reply({visit:null});
    if(path==="/api/v1/tour-plans") return reply({plans:[]});
    if(path==="/api/v1/org-units") return reply({units:[{id:TERRITORY,parentId:null,type:"territory",code:"TER",name:"Central Territory",status:"active"}]});
    if(path==="/api/v1/masters/doctors") {
      customerReads.push(tenant);
      if(tenant!==A&&tenant!==B)return reply({error:"Missing or unauthorized tenant header"},403);
      return reply({items:[
        {id:tenant===A?CUSTOMER_A:CUSTOMER_B,code:tenant===A?"A001":"B001",name:tenant===A?"Doctor Alpha":"Doctor Beta",
         status:"active",territoryId:TERRITORY}
      ]});
    }
    if(path.startsWith("/api/v1/masters/"))return reply({items:[]});
    return reply({error:"Unexpected route "+path},404);
  });
  await page.goto("/");
  await page.locator("#account-email").fill("user@example.invalid");
  await page.locator("#account-password").fill("password");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.locator("#org-select").selectOption(A);
  await page.getByRole("button",{name:"Customer 360"}).click();
  await expect(page.getByText("Doctor Alpha")).toBeVisible();
  await page.getByRole("button",{name:"View doctor Doctor Alpha"}).click();
  await expect(page.getByRole("heading",{name:"Doctor Alpha"})).toBeVisible();

  await page.getByRole("combobox",{name:"Switch organization"}).selectOption(B);
  await expect(page.getByText("Doctor Alpha")).toHaveCount(0);
  await expect(page.getByText("Doctor Beta")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Doctor Alpha"})).toHaveCount(0);
  expect(customerReads).toContain(A);
  expect(customerReads).toContain(B);
  expect(customerReads.at(-1)).toBe(B);

  await page.getByRole("button",{name:"View doctor Doctor Beta"}).click();
  await page.getByRole("button",{name:"Open plan"}).click();
  await expect(page.getByRole("group",{name:"Monthly tour plan calendar"})).toBeVisible();
  await expect(page.locator("#calendar-territory")).toHaveValue(TERRITORY);
  await expect(page.locator("#calendar-account")).toHaveValue(CUSTOMER_B);
  await expect(page.getByText("Selected from Customer 360:")).toBeVisible();

  await page.getByRole("button",{name:"NCA & activities"}).click();
  await expect(page.getByRole("heading",{name:"Planned, unplanned and non-call activity"})).toBeVisible();
  await expect(page.getByText("Draft only — no verified NCA submission API").first()).toBeVisible();
  await expect(page.getByRole("button",{name:"Review activity draft"})).toBeDisabled();

  await page.getByRole("button",{name:"E-detailing / CLM"}).click();
  await expect(page.getByRole("heading",{name:"E-detailing / CLM",level:2})).toBeVisible();
  await expect(page.getByText("No approved content available for these filters.")).toBeVisible();
  await expect(page.getByRole("button",{name:"Start detailing"})).toHaveCount(0);

  await page.getByRole("button",{name:"Today briefing"}).click();
  await expect(page.getByRole("heading",{name:"Field execution briefing"})).toBeVisible();
  await expect(page.getByText("No validated suggestions available.")).toBeVisible();
  expect(mutations).toEqual(["/api/v1/auth/login"]);

  // After real authorized records loaded, disconnect must erase them from every
  // feature, not just show an empty state on a fresh anonymous page.
  await page.getByRole("button",{name:"Customer 360"}).click();
  await page.getByRole("button",{name:"View doctor Doctor Beta"}).click();
  await expect(page.getByRole("heading",{name:"Doctor Beta"})).toBeVisible();
  await page.getByRole("button",{name:"Disconnect",exact:true}).click();
  await expect(page.getByText("Doctor Beta")).toHaveCount(0);
  for(const name of ["Customer 360","NCA & activities","E-detailing / CLM","Today briefing"]){
    await page.getByRole("button",{name,exact:true}).click();
    await expect(page.getByText("Doctor Beta")).toHaveCount(0);
  }
});

test("delegated feature panels cannot disclose records while not connected",async({page})=>{
  await page.goto("/");
  for(const [button,title] of [
    ["Customer 360","Authorized customer directory"],
    ["NCA & activities","Planned, unplanned and non-call activity"],
    ["E-detailing / CLM","E-detailing / CLM"],
    ["Today briefing","Field execution briefing"],
  ]){
    await page.getByRole("button",{name:button,exact:true}).click();
    await expect(page.getByRole("heading",{name:title,level:2})).toBeVisible();
  }
  await expect(page.getByText("No validated suggestions available.")).toBeVisible();
});
