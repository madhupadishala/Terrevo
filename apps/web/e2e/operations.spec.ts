import { test, expect, type Route } from "@playwright/test";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PLAN_DAY = "22222222-2222-4222-8222-222222222222";
const STOP = "33333333-3333-4333-8333-333333333333";
const TARGET = "44444444-4444-4444-8444-444444444444";
const EXECUTION = "55555555-5555-4555-8555-555555555555";
const VISIT = "66666666-6666-4666-8666-666666666666";
const TOUR_PLAN = "77777777-7777-4777-8777-777777777777";
const USER = "88888888-8888-4888-8888-888888888888";

test("public UI exposes role workspaces without inventing data or performing writes", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Operations, connected." })).toBeVisible();
  await expect(page.getByText("Terrevo is online.")).toHaveCount(0);
  await page.getByRole("button", { name: "Field execution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Start My Tour" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start My Tour (GPS)" })).toBeDisabled();
  await page.getByRole("button", { name: "Manager command" }).click();
  await expect(page.getByText("Manager workspace is permission-gated")).toBeVisible();
  await page.getByRole("button", { name: "Platform Super Admin" }).click();
  await expect(page.getByRole("heading", { name: "Connect an existing authorized account" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("authorized field user can use real API endpoints for tour and visit lifecycle", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 17.385, longitude: 78.4867, accuracy: 15 });

  let started = false, checkedIn = false, submitted = false;
  const mutations: Array<{ path: string; body: Record<string, unknown>; tenant: string | null }> = [];
  const progress = () => !started || submitted ? null : ({
    executionId: EXECUTION, workDate: "2026-10-12", territoryId: TENANT,
    startedAt: "2026-10-12T03:00:00Z", serverNow: "2026-10-12T03:05:00Z",
    requiredMinutes: 480, elapsedMinutes: 5, remainingMinutes: 475,
    plannedCount: 1, completedCount: checkedIn ? 0 : 0,
    inProgressCount: checkedIn ? 1 : 0, pendingCount: checkedIn ? 0 : 1,
    stops: [{ planStopId: STOP, sequence: 1, type: "doctor", targetId: TARGET, targetName: "Test Physician", status: checkedIn ? "IN_PROGRESS" : "PENDING" }],
  });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method !== "GET") {
      mutations.push({ path, body: request.postDataJSON() as Record<string, unknown>, tenant: request.headers()["x-tenant-id"] ?? null });
    }
    const answer = async (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/v1/auth/login") return answer({ accessToken: "test-user-token", refreshToken: "test-refresh-token", expiresIn: 3600, user: { id: USER, email: "test@example.invalid" } });
    if (path === "/api/v1/tenants") return answer({ tenants: [{ id: TENANT, name: "Test Organization", slug: "test", status: "active" }] });
    if (path === "/api/v1/access-context") return answer({ context: { roles: [{ roleKey: "MR", scopeOrgUnitId: TENANT }], permissions: ["TOUR_PLAN_OWN"], orgAssignments: [{ orgUnitId: TENANT, isPrimary: true }] } });
    if (path === "/api/v1/tour-executions/progress") return answer({ progress: progress() });
    if (path === "/api/v1/tour-executions/start-options") return answer({ options: started ? [] : [{ planId: TOUR_PLAN, planDayId: PLAN_DAY, workDate: "2026-10-12", territoryId: TENANT }] });
    if (path === "/api/v1/visits/open") return answer({ visit: checkedIn ? { id: VISIT, executionId: EXECUTION, planStopId: STOP, territoryId: TENANT, status: "CHECKED_IN", verification: "VERIFIED", exceptionStatus: "NOT_REQUIRED", distanceMeters: 4, geofenceRadiusMeters: 100, checkinAt: "2026-10-12T03:05:00Z", checkoutAt: null } : null });
    if (path === "/api/v1/tour-plans") return answer({ plans: [] });
    if (path === "/api/v1/org-units") return answer({ units: [{ id: TENANT, parentId: null, type: "territory", code: "TEST", name: "Test Territory", status: "active" }] });
    if (path.startsWith("/api/v1/masters/")) return answer({ items: path.endsWith("/doctors") ? [{ id: TARGET, code: "T001", name: "Test Physician", status: "active", territoryId: TENANT }] : [] });
    if (path === "/api/v1/tour-executions/start") { started = true; return answer({ execution: { id: EXECUTION } }, 201); }
    if (path === "/api/v1/visits/check-in") { checkedIn = true; return answer({ visit: { id: VISIT } }, 201); }
    if (path === `/api/v1/visits/${VISIT}/doctor-call`) return answer({ doctorCall: { id: TARGET } });
    if (path === `/api/v1/visits/${VISIT}/check-out`) { checkedIn = false; return answer({ visit: { id: VISIT, status: "CHECKED_OUT" } }); }
    if (path === "/api/v1/tour-executions/submit") { submitted = true; return answer({ execution: { id: EXECUTION, status: "SUBMITTED" } }); }
    return answer({ error: `Unexpected ${method} ${path}` }, 404);
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Existing account email" }).fill("test@example.invalid");
  await page.getByRole("textbox", { name: "Password" }).fill("test-pass");
  await page.getByRole("button", { name: "Connect to live workflows" }).click();
  await expect(page.getByRole("complementary", { name: "Terrevo navigation" }).getByText("Test Organization")).toBeVisible();
  await page.getByRole("button", { name: "Field execution", exact: true }).click();
  await page.locator("#approved-day").selectOption(PLAN_DAY);
  await page.getByRole("button", { name: "Start My Tour (GPS)" }).click();
  await expect(page.getByText("Tour started", { exact: true })).toBeVisible();
  await page.locator("#stop-select").selectOption(STOP);
  await page.getByRole("button", { name: "Check in using device GPS" }).click();
  await expect(page.getByText("Field check-in saved")).toBeVisible();
  await page.locator("#call-outcome").fill("Detailed");
  await page.getByRole("button", { name: "Save call outcome" }).click();
  await expect(page.getByText("Call outcome saved")).toBeVisible();
  await page.getByRole("button", { name: "Check out with location" }).click();
  await expect(page.getByText("Checked out of field visit")).toBeVisible();
  await page.getByRole("button", { name: "Submit My Tour" }).click();
  await expect(page.getByText("Tour submitted", { exact: true })).toBeVisible();
  expect(mutations.map(item=>item.path)).toEqual([
    "/api/v1/auth/login", "/api/v1/tour-executions/start", "/api/v1/visits/check-in",
    `/api/v1/visits/${VISIT}/doctor-call`, `/api/v1/visits/${VISIT}/check-out`,
    "/api/v1/tour-executions/submit",
  ]);
  expect(mutations.slice(1).every(x=>x.tenant===TENANT)).toBe(true);
  expect(mutations[1].body).toMatchObject({ planDayId: PLAN_DAY, latitude: 17.385, longitude: 78.4867 });
});

test("tenant administrator can open manager and organization administration with authorized API", async ({ page }) => {
  await page.route("**/api/v1/**", async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    const reply = (body: unknown, status=200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/auth/login")) return reply({ accessToken: "test-admin-token", refreshToken: "t", expiresIn: 3600, user: { id: USER, email: null } });
    if (path.endsWith("/tenants")) return reply({ tenants: [{id:TENANT, name:"Organization Admin Test", slug:"test", status:"active"}] });
    if (path.endsWith("/access-context")) return reply({ context: { roles:[{roleKey:"TENANT_ADMIN",scopeOrgUnitId:null}], permissions:["ORG_MANAGE","RBAC_MANAGE"],orgAssignments:[] } });
    if (path.endsWith("/org-units")) return reply({ units:[] });
    if (path.includes("/masters/")) return reply({ items:[] });
    if (path.endsWith("/tour-executions/progress")) return reply({ progress:null });
    if (path.endsWith("/tour-executions/start-options")) return reply({options:[]});
    if (path.endsWith("/visits/open")) return reply({visit:null});
    if (path.endsWith("/tour-plans")) return reply({plans:[]});
    if (path.endsWith("/tour-approvals")) return reply({plans:[]});
    if (path.endsWith("/manager/command-center")) return reply({commandCenter:{ localDate:"2026-10-10",teamMembers:3,activeTours:1,submittedToursToday:2,shortDaysToday:0,activeJointWork:0,pending:{tourApprovals:0,gpsExceptions:0,weeklyTimesheets:0,leaves:0,expenses:0} }});
    if (path.includes("/manager/analytics")) return reply({analytics:{ period:{days:7,startDate:"2026-10-03",endDate:"2026-10-10"},tours:{submitted:2,totalWorkedMinutes:800},coverage:{plannedStops:3,completedVisits:2,doctorCalls:2,chemistCalls:0,stockistCalls:0}}});
    if (path.endsWith("/auth/logout")) return reply({}, 200);
    return reply({error:"Unhandled"},404);
  });
  await page.goto("/");
  await page.locator("#account-email").fill("admin@example.invalid");
  await page.locator("#account-password").fill("password");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.getByRole("button",{name:"Manager command"}).click();
  await expect(page.getByText("Field team members")).toBeVisible();
  await expect(page.getByText("3", {exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"Organization admin"}).click();
  await expect(page.getByRole("heading",{name:"Manage reporting hierarchy"})).toBeVisible();
  await page.getByRole("button",{name:"Platform Super Admin"}).click();
  await expect(page.getByRole("heading", { name: "Platform permissions required" })).toBeVisible();
});

test("platform administrator without a tenant can create and manage organizations with authorized platform APIs", async ({ page }) => {
  const actor="11111111-1111-4111-8111-111111111111";
  const tenantId="22222222-2222-4222-8222-222222222222";
  let organizations:Array<{id:string;name:string;slug:string;status:"active"|"inactive"}>=[];
  const calls:string[]=[];
  await page.route("**/api/v1/**", async route => {
    const req=route.request();const path=new URL(req.url()).pathname;
    const json=(body:unknown,status=200)=>route.fulfill({contentType:"application/json",status,body:JSON.stringify(body)});
    if(path==="/api/v1/auth/login")return json({accessToken:"test",refreshToken:"refresh",expiresIn:3600,user:{id:actor,email:null}});
    if(path==="/api/v1/platform/context")return json({isSuperAdmin:true});
    if(path==="/api/v1/tenants")return json({tenants:[]});
    if(path==="/api/v1/platform/tenants"&&req.method()==="GET")return json({tenants:organizations});
    if(path==="/api/v1/platform/audit")return json({events:[]});
    if(path==="/api/v1/platform/tenants"&&req.method()==="POST"){
      calls.push(path);
      const input=req.postDataJSON() as {name:string;slug:string};
      const item={id:tenantId,name:input.name,slug:input.slug,status:"active" as const};
      organizations=[item];return json({tenant:item},201);
    }
    if(path==="/api/v1/platform/tenants/"+tenantId+"/status"){
      calls.push(path);
      organizations=[{...organizations[0],status:"inactive"}];return json({tenant:organizations[0]});
    }
    return json({error:"Unexpected request"},404);
  });
  await page.goto("/");
  await page.locator("#account-email").fill("existing@example.invalid");
  await page.locator("#account-password").fill("existing-password");
  await page.getByRole("button",{name:"Connect to live workflows"}).click();
  await page.getByRole("button",{name:"Platform Super Admin"}).click();
  await expect(page.getByRole("heading",{name:"Organizations"})).toBeVisible();
  await page.locator("#platform-tenant-name").fill("Example Pharma");
  await page.locator("#platform-tenant-slug").fill("example-pharma");
  await page.getByRole("button",{name:"Create organization"}).click();
  await expect(page.getByText("Example Pharma")).toBeVisible();
  await page.getByRole("button",{name:"Deactivate organization"}).click();
  await expect(page.getByRole("button",{name:"Activate organization"})).toBeVisible();
  expect(calls).toEqual(["/api/v1/platform/tenants","/api/v1/platform/tenants/"+tenantId+"/status"]);
});
