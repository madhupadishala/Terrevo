import { AuthInputError, createIdentityService, readBearerToken } from "../../../modules/identity/src/index.ts";
import { createTenantService, TenantAccessError } from "../../../modules/tenant/src/index.ts";
import { createOrganizationService, OrganizationInputError } from "../../../modules/organization/src/index.ts";
import { AuthorizationError, createRbacService, RbacInputError } from "../../../modules/rbac/src/index.ts";
import { createMastersService, MASTER_KINDS, MasterInputError, type MasterKind } from "../../../modules/masters/src/index.ts";
import { createTourPlanningService, TourPlanConflictError, TourPlanInputError, TourPlanNotFoundError } from "../../../modules/tour-planning/src/index.ts";
import { createTourApprovalService, TourApprovalConflictError, TourApprovalInputError, TourApprovalNotFoundError } from "../../../modules/tour-approval/src/index.ts";
import { createTourExecutionService, TourExecutionConflictError, TourExecutionInputError, TourExecutionNotFoundError } from "../../../modules/tour-execution/src/index.ts";
import { createTourProgressService } from "../../../modules/tour-progress/src/index.ts";
import { createVisitService, VisitConflictError, VisitInputError, VisitNotFoundError } from "../../../modules/visit-execution/src/index.ts";
import { createDoctorCallService, DoctorCallConflictError, DoctorCallInputError, DoctorCallNotFoundError } from "../../../modules/doctor-call/src/index.ts";
import { createInventoryService, InventoryInputError, InventoryNotFoundError } from "../../../modules/inventory/src/index.ts";
import { createSubmitTourService, SubmitTourConflictError, SubmitTourInputError } from "../../../modules/tour-submit/src/index.ts";
import { createDailyTimesheetService, DailyTimesheetConflictError, DailyTimesheetInputError, DailyTimesheetNotFoundError } from "../../../modules/timesheet-daily/src/index.ts";
import { createWeeklyTimesheetService, WeeklyTimesheetConflictError, WeeklyTimesheetInputError, WeeklyTimesheetNotFoundError } from "../../../modules/timesheet-weekly/src/index.ts";
import { createTradeCallService, TradeCallConflictError, TradeCallInputError, TradeCallNotFoundError } from "../../../modules/trade-call/src/index.ts";
import { createRcpaService, RcpaConflictError, RcpaInputError, RcpaNotFoundError } from "../../../modules/rcpa/src/index.ts";
import { createOrderService, OrderConflictError, OrderInputError, OrderNotFoundError } from "../../../modules/orders/src/index.ts";
import { createAttendanceLeaveService, LeaveConflictError, LeaveInputError, LeaveNotFoundError } from "../../../modules/attendance-leave/src/index.ts";
import { createNcaService, NcaInputError, NcaConflictError, NcaNotFoundError } from "../../../modules/nca/src/index.ts";
import {createUnplannedCallService,UnplannedInputError,UnplannedConflictError,UnplannedNotFoundError} from "../../../modules/unplanned-calls/src/index.ts";
import { createExpenseService, ExpenseConflictError, ExpenseInputError, ExpenseNotFoundError } from "../../../modules/expenses/src/index.ts";
import { createJointWorkService, JointWorkConflictError, JointWorkInputError, JointWorkNotFoundError } from "../../../modules/joint-work/src/index.ts";
import { createManagerCommandService } from "../../../modules/manager-command/src/index.ts";
import { AnalyticsInputError, createAnalyticsService } from "../../../modules/analytics/src/index.ts";
import { createSupabaseAdapter, ProviderError, type SupabaseConfig } from "./supabase-adapter.ts";
import { createPlatformAdminService, PlatformForbiddenError, PlatformValidationError, PlatformNotFoundError } from "./platform-admin.ts";
import { readBoundedJsonObject, RequestBodyError } from "../../../modules/security/src/index.ts";

export type ApiEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TERREVO_ENVIRONMENT?: string;
  VERCEL_ENV?: string;
};

type Deps = {
  fetcher?: typeof fetch;
};

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Returns a no-store JSON response for API contracts. */
function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/** Parses a bounded JSON object request body and rejects non-object payloads. */
async function readJsonObject(request: Request, maxBytes = 8_192): Promise<Record<string, unknown>> {
  return readBoundedJsonObject(request, maxBytes);
}

/** Resolves the supported Supabase environment aliases into one provider configuration. */
function requireConfig(env: ApiEnv): SupabaseConfig {
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.SUPABASE_URL || !publishableKey) {
    throw new ApiError(500, "Identity provider is not configured");
  }
  return {
    url: env.SUPABASE_URL,
    anonKey: publishableKey,
    serviceRoleKey: secretKey,
  };
}

/** Deployment identity is derived from server-owned runtime configuration, never a query/header. */
export function runtimeQualificationProof(env: ApiEnv, tenantId: string) {
  const ref=/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(env.SUPABASE_URL??"")?.[1]??null;
  const isStaging=env.TERREVO_ENVIRONMENT==="staging" &&
    env.VERCEL_ENV!=="production" && ref!==null &&
    ref!=="dfqsnkmmumvjwmvtnlcs";
  return { environment:isStaging?"staging":"unverified", projectRef:ref, tenantId };
}

/** Maps domain and provider failures to stable public API responses. */
function mapError(error: unknown): Response {
  if (error instanceof ApiError || error instanceof RequestBodyError) return json(error.status, { error: error.message });
  if (error instanceof AuthInputError) {
    const status = error.message.includes("Authorization header") ? 401 : 400;
    return json(status, { error: error.message });
  }
  if (error instanceof TenantAccessError) {
    const status = error.message.includes("access denied") ? 403 : 400;
    return json(status, { error: error.message });
  }
  if (error instanceof AuthorizationError || error instanceof PlatformForbiddenError) return json(403, { error: "Permission denied" });
  if (error instanceof PlatformValidationError) return json(400, { error: error.message });
  if (error instanceof PlatformNotFoundError) return json(404, { error: error.message });
  if (error instanceof OrganizationInputError || error instanceof RbacInputError || error instanceof MasterInputError || error instanceof TourPlanInputError || error instanceof TourApprovalInputError || error instanceof TourExecutionInputError || error instanceof VisitInputError || error instanceof DoctorCallInputError || error instanceof InventoryInputError || error instanceof SubmitTourInputError || error instanceof DailyTimesheetInputError || error instanceof WeeklyTimesheetInputError || error instanceof TradeCallInputError || error instanceof RcpaInputError || error instanceof OrderInputError || error instanceof LeaveInputError || error instanceof NcaInputError || error instanceof UnplannedInputError || error instanceof ExpenseInputError || error instanceof JointWorkInputError || error instanceof AnalyticsInputError) {
    return json(400, { error: error.message });
  }
  if (error instanceof TourPlanNotFoundError || error instanceof TourApprovalNotFoundError || error instanceof TourExecutionNotFoundError || error instanceof VisitNotFoundError || error instanceof DoctorCallNotFoundError || error instanceof InventoryNotFoundError || error instanceof DailyTimesheetNotFoundError || error instanceof WeeklyTimesheetNotFoundError || error instanceof TradeCallNotFoundError || error instanceof RcpaNotFoundError || error instanceof OrderNotFoundError || error instanceof LeaveNotFoundError || error instanceof NcaNotFoundError || error instanceof UnplannedNotFoundError || error instanceof ExpenseNotFoundError || error instanceof JointWorkNotFoundError) return json(404, { error: error.message });
  if (error instanceof TourPlanConflictError || error instanceof TourApprovalConflictError || error instanceof TourExecutionConflictError || error instanceof VisitConflictError || error instanceof DoctorCallConflictError || error instanceof SubmitTourConflictError || error instanceof DailyTimesheetConflictError || error instanceof WeeklyTimesheetConflictError || error instanceof TradeCallConflictError || error instanceof RcpaConflictError || error instanceof OrderConflictError || error instanceof LeaveConflictError || error instanceof NcaConflictError || error instanceof UnplannedConflictError || error instanceof ExpenseConflictError || error instanceof JointWorkConflictError) return json(409, { error: error.message });
  if (error instanceof ProviderError) {
    if (error.status === 401 || error.status === 403) return json(401, { error: "Authentication failed" });
    if (error.status === 400) return json(400, { error: "Provider rejected request" });
    if (error.status === 404) return json(404, { error: "Not found" });
    if (error.status === 409) return json(409, { error: "Conflict" });
    return json(502, { error: "Provider request failed" });
  }
  return json(500, { error: "Internal server error" });
}

/** Creates the HTTP API handler with tenant-scoped domain services wired to the provider adapter. */
export function createHandler(env: ApiEnv, deps: Deps = {}) {
  const adapter = createSupabaseAdapter(requireConfig(env), deps.fetcher);
  const identity = createIdentityService(adapter.auth);
  const tenants = createTenantService(adapter.tenants);
  const rbac = createRbacService(adapter.rbac);
  const organization = createOrganizationService(adapter.organization, rbac);
  const masters = createMastersService(adapter.masters, adapter.organization, rbac);
  const tourPlanning = createTourPlanningService(adapter.tourPlanning, rbac);
  const tourApproval = createTourApprovalService(adapter.tourApproval, rbac);
  const tourExecution = createTourExecutionService(adapter.tourExecution, rbac);
  const tourProgress = createTourProgressService(adapter.tourProgress);
  const visits = createVisitService(adapter.visits, rbac);
  const doctorCalls = createDoctorCallService(adapter.doctorCalls);
  const inventory = createInventoryService(adapter.inventory, adapter.masters, rbac);
  const tourSubmit = createSubmitTourService(adapter.tourSubmit);
  const dailyTimesheets = createDailyTimesheetService(adapter.dailyTimesheets);
  const weeklyTimesheets = createWeeklyTimesheetService(adapter.weeklyTimesheets, rbac);
  const tradeCalls = createTradeCallService(adapter.tradeCalls);
  const rcpa = createRcpaService(adapter.rcpa);
  const orders = createOrderService(adapter.orders);
  const attendanceLeave = createAttendanceLeaveService(adapter.attendanceLeave, rbac);
  const nca = createNcaService(adapter.nca,rbac);
  const unplanned = createUnplannedCallService(adapter.unplanned,rbac,adapter.masters);
  const expenses = createExpenseService(adapter.expenses, rbac);
  const jointWork = createJointWorkService(adapter.jointWork, rbac);
  const managerCommand = createManagerCommandService(adapter.managerCommand);
  const analytics = createAnalyticsService(adapter.analytics);
  const platform = createPlatformAdminService(requireConfig(env), deps.fetcher);

  /** Authenticates the caller and resolves the active tenant context for a tenant-scoped request. */
  async function resolveTenantRequest(request: Request) {
    const accessToken = readBearerToken(request.headers.get("authorization"));
    const user = await identity.authenticate(request.headers.get("authorization"));
    const context = await tenants.resolveContext(
      user.id,
      request.headers.get("x-tenant-id"),
      accessToken,
    );
    return { accessToken, user, context };
  }

  /** Routes one HTTP request through authenticated Terrevo API contracts. */
  return async function handle(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;

      if (request.method === "GET" && path === "/health") return json(200, { status: "ok" });

      if (request.method === "POST" && path === "/v1/auth/login") {
        const body = await readJsonObject(request);
        return json(200, await identity.signIn(body.email, body.password));
      }

      if (request.method === "POST" && path === "/v1/auth/refresh") {
        const body = await readJsonObject(request);
        return json(200, await identity.refreshSession(body.refreshToken));
      }

      if (request.method === "POST" && path === "/v1/auth/password-reset") {
        const body = await readJsonObject(request);
        await identity.requestPasswordReset(body.email);
        return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
      }

      if (request.method === "POST" && path === "/v1/auth/logout") {
        await identity.signOut(request.headers.get("authorization"));
        return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      }

      if (request.method === "GET" && path === "/v1/me") {
        return json(200, { user: await identity.authenticate(request.headers.get("authorization")) });
      }

      // Authenticated runtime proof for staging qualification. Never accept a
      // client-supplied environment or project reference as evidence of safety.
      if (request.method === "GET" && path === "/v1/qualification/target") {
        const {context}=await resolveTenantRequest(request);
        return json(200,runtimeQualificationProof(env,context.tenantId));
      }

      // Platform administration is strictly separate from tenant RBAC.
      // All platform requests first validate the caller's Supabase-issued bearer token.
      if (path === "/v1/platform/context" && request.method === "GET") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        return json(200, { isSuperAdmin: await platform.isPlatformAdmin(user.id) });
      }
      if (path === "/v1/platform/tenants" && request.method === "GET") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
        return json(200, { tenants: await platform.listTenants(user.id, offset) });
      }
      if (path === "/v1/platform/tenants" && request.method === "POST") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        return json(201, { tenant: await platform.createTenant(user.id, await readJsonObject(request)) });
      }
      const platformStatus = /^\/v1\/platform\/tenants\/([^/]+)\/status$/.exec(path);
      if (platformStatus && request.method === "PATCH") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        return json(200, { tenant: await platform.setTenantStatus(user.id, platformStatus[1], await readJsonObject(request)) });
      }
      if (path === "/v1/platform/audit" && request.method === "GET") {
        const user = await identity.authenticate(request.headers.get("authorization"));
        const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
        return json(200, { events: await platform.audit(user.id, offset) });
      }

      if (request.method === "GET" && path === "/v1/tenants") {
        const accessToken = readBearerToken(request.headers.get("authorization"));
        await identity.authenticate(request.headers.get("authorization"));
        return json(200, { tenants: await tenants.listAccessible(accessToken) });
      }

      if (request.method === "GET" && path === "/v1/tenant-context") {
        const { context } = await resolveTenantRequest(request);
        return json(200, { context });
      }

      if (request.method === "GET" && path === "/v1/org-units") {
        const { accessToken, context } = await resolveTenantRequest(request);
        return json(200, { units: await organization.listUnits(context.tenantId, accessToken) });
      }

      if (request.method === "POST" && path === "/v1/org-units") {
        const { accessToken, context } = await resolveTenantRequest(request);
        const body = await readJsonObject(request);
        const unit = await organization.createUnit(context.tenantId, accessToken, body);
        return json(201, { unit });
      }

      if (request.method === "POST" && path === "/v1/org-assignments") {
        const { accessToken, context } = await resolveTenantRequest(request);
        await organization.assignUser(context.tenantId, accessToken, await readJsonObject(request));
        return new Response(null, { status: 204 });
      }

      if (request.method === "GET" && path === "/v1/access-context") {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        return json(200, {
          context: await rbac.accessContext(context.tenantId, user.id, accessToken),
        });
      }

      if(request.method==="GET"&&path==="/v1/manager/command-center"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{commandCenter:await managerCommand.get(context.tenantId,accessToken)});}
      if(request.method==="GET"&&path==="/v1/manager/analytics"){const {accessToken,context}=await resolveTenantRequest(request);const raw=new URL(request.url).searchParams.get("days");const days=raw===null?7:Number(raw);return json(200,{analytics:await analytics.getManagerAnalytics(context.tenantId,accessToken,days)});}
      if(request.method==="GET"&&path==="/v1/joint-work/own"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{assignments:await jointWork.listSelf(context.tenantId,user.id,accessToken)});}if(request.method==="GET"&&path==="/v1/joint-work"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{assignments:await jointWork.list(context.tenantId,accessToken)});}
      if(request.method==="POST"&&path==="/v1/joint-work"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(201,{assignment:await jointWork.schedule(context.tenantId,user.id,accessToken,await readJsonObject(request))});}
      const join=/^\/v1\/joint-work\/([^/]+)\/join$/.exec(path);if(request.method==="POST"&&join){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{assignment:await jointWork.join(context.tenantId,user.id,accessToken,join[1],await readJsonObject(request))});}
      const leave=/^\/v1\/joint-work\/([^/]+)\/leave$/.exec(path);if(request.method==="POST"&&leave){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{assignment:await jointWork.leave(context.tenantId,user.id,accessToken,leave[1],await readJsonObject(request))});}
      if(request.method==="GET"&&path==="/v1/expenses/own"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{claims:await expenses.listOwn(context.tenantId,user.id,accessToken)});}if(request.method==="GET"&&path==="/v1/expenses"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{claims:await expenses.list(context.tenantId,accessToken)});}
      const expenseByExecution=/^\/v1\/executions\/([^/]+)\/expense$/.exec(path);if(request.method==="PUT"&&expenseByExecution){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{claim:await expenses.save(context.tenantId,user.id,accessToken,expenseByExecution[1],await readJsonObject(request,65536))});}
      if(request.method==="GET"&&path==="/v1/expense-approvals"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{claims:await expenses.listPending(context.tenantId,accessToken)});}
      const expenseSubmit=/^\/v1\/expenses\/([^/]+)\/submit$/.exec(path);if(request.method==="POST"&&expenseSubmit){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{claim:await expenses.submit(context.tenantId,user.id,accessToken,expenseSubmit[1],await readJsonObject(request))});}
      const expenseDecision=/^\/v1\/expense-approvals\/([^/]+)\/decision$/.exec(path);if(request.method==="POST"&&expenseDecision){const {accessToken,user,context}=await resolveTenantRequest(request);await expenses.decide(context.tenantId,user.id,accessToken,expenseDecision[1],await readJsonObject(request));return new Response(null,{status:204});}
      if(request.method==="GET"&&path==="/v1/attendance"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{attendance:await attendanceLeave.listAttendance(context.tenantId,accessToken)});}

      // Planned calls remain on approved tour stops with GPS visit/DCR workflow.
      // Unplanned calls are separate GPS-evidenced transactions awaiting manager review.
      if(request.method==="GET"&&path==="/v1/unplanned-calls/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{calls:await unplanned.own(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/unplanned-calls"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{call:await unplanned.submit(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      if(request.method==="GET"&&path==="/v1/unplanned-approvals"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{calls:await unplanned.pending(context.tenantId,accessToken)});
      }
      const unplannedDecision=/^\/v1\/unplanned-approvals\/([^/]+)\/decision$/.exec(path);
      if(request.method==="POST"&&unplannedDecision){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{call:await unplanned.decide(context.tenantId,user.id,accessToken,unplannedDecision[1],await readJsonObject(request))});
      }

      // NCA is a distinct governed field-activity contract, never a doctor call.
      if(request.method==="GET"&&path==="/v1/nca/options"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{options:await nca.options(context.tenantId,accessToken)});
      }
      if(request.method==="GET"&&path==="/v1/nca/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{records:await nca.listOwn(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/nca"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{record:await nca.save(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
            const ncaSubmit=/^\/v1\/nca\/([^/]+)\/submit$/.exec(path);
      if(request.method==="POST"&&ncaSubmit){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{record:await nca.submit(context.tenantId,user.id,accessToken,ncaSubmit[1])});
      }
      if(request.method==="POST"&&path==="/v1/nca/categories"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{category:await nca.configureCategory(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      if(request.method==="POST"&&path==="/v1/nca/towns"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{town:await nca.configureTown(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }

      if(request.method==="GET"&&path==="/v1/leaves/own"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(200,{leaves:await attendanceLeave.listOwnLeaves(context.tenantId,user.id,accessToken)});}if(request.method==="GET"&&path==="/v1/leaves"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{leaves:await attendanceLeave.listLeaves(context.tenantId,accessToken)});}
      if(request.method==="POST"&&path==="/v1/leaves"){const {accessToken,user,context}=await resolveTenantRequest(request);return json(201,{leave:await attendanceLeave.submit(context.tenantId,user.id,accessToken,await readJsonObject(request))});}
      if(request.method==="GET"&&path==="/v1/leave-approvals"){const {accessToken,context}=await resolveTenantRequest(request);return json(200,{leaves:await attendanceLeave.listPending(context.tenantId,accessToken)});}
      const leaveDecision=/^\/v1\/leave-approvals\/([^/]+)\/decision$/.exec(path);if(request.method==="POST"&&leaveDecision){const {accessToken,user,context}=await resolveTenantRequest(request);await attendanceLeave.decide(context.tenantId,user.id,accessToken,leaveDecision[1],await readJsonObject(request));return new Response(null,{status:204});}
      const orderMatch=/^\/v1\/visits\/([^/]+)\/order$/.exec(path);if(orderMatch){const {accessToken,user,context}=await resolveTenantRequest(request);if(request.method==="GET")return json(200,{order:await orders.get(context.tenantId,accessToken,orderMatch[1])});if(request.method==="PUT")return json(200,{order:await orders.save(context.tenantId,user.id,accessToken,orderMatch[1],await readJsonObject(request,65536))});}
      const rcpaMatch=/^\/v1\/visits\/([^/]+)\/rcpa$/.exec(path);
      if(rcpaMatch){const {accessToken,user,context}=await resolveTenantRequest(request);if(request.method==="GET")return json(200,{rcpa:await rcpa.get(context.tenantId,accessToken,rcpaMatch[1])});if(request.method==="PUT")return json(200,{rcpa:await rcpa.save(context.tenantId,user.id,accessToken,rcpaMatch[1],await readJsonObject(request,65536))});}
      const tradeCall=/^\/v1\/visits\/([^/]+)\/trade-call$/.exec(path);
      if(tradeCall){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET")return json(200,{tradeCall:await tradeCalls.get(context.tenantId,accessToken,tradeCall[1])});
        if(request.method==="PUT")return json(200,{tradeCall:await tradeCalls.save(context.tenantId,user.id,accessToken,tradeCall[1],await readJsonObject(request))});
      }

      if(request.method==="GET"&&path==="/v1/timesheets/weekly/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await weeklyTimesheets.listOwn(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="GET"&&path==="/v1/timesheets/weekly"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await weeklyTimesheets.list(context.tenantId,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/timesheets/weekly/generate"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{timesheet:await weeklyTimesheets.generate(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      if(request.method==="GET"&&path==="/v1/timesheet-approvals"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await weeklyTimesheets.listPending(context.tenantId,accessToken)});
      }
      const weeklyDecision=/^\/v1\/timesheet-approvals\/([^/]+)\/decision$/.exec(path);
      if(request.method==="POST"&&weeklyDecision){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        await weeklyTimesheets.decide(context.tenantId,user.id,accessToken,weeklyDecision[1],await readJsonObject(request));
        return new Response(null,{status:204});
      }
      const weeklySubmit=/^\/v1\/timesheets\/weekly\/([^/]+)\/submit$/.exec(path);
      if(request.method==="POST"&&weeklySubmit){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await weeklyTimesheets.submit(context.tenantId,user.id,accessToken,weeklySubmit[1],await readJsonObject(request))});
      }
      const weeklyOne=/^\/v1\/timesheets\/weekly\/([^/]+)$/.exec(path);
      if(request.method==="GET"&&weeklyOne){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await weeklyTimesheets.get(context.tenantId,accessToken,weeklyOne[1])});
      }

      if(request.method==="GET"&&path==="/v1/timesheets/daily/own"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await dailyTimesheets.listSelf(context.tenantId,user.id,accessToken)});
      }
      if(request.method==="GET"&&path==="/v1/timesheets/daily"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheets:await dailyTimesheets.list(context.tenantId,accessToken)});
      }
      const dailyReview=/^\/v1\/timesheets\/daily\/([^/]+)\/review$/.exec(path);
      if(request.method==="POST"&&dailyReview){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await dailyTimesheets.review(
          context.tenantId,user.id,accessToken,dailyReview[1],await readJsonObject(request)
        )});
      }
      const dailyOne=/^\/v1\/timesheets\/daily\/([^/]+)$/.exec(path);
      if(request.method==="GET"&&dailyOne){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{timesheet:await dailyTimesheets.get(context.tenantId,accessToken,dailyOne[1])});
      }

      if(request.method==="POST"&&path==="/v1/tour-executions/submit"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{execution:await tourSubmit.submit(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }

      if(request.method==="GET"&&path==="/v1/inventory"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{balances:await inventory.listBalances(context.tenantId,accessToken)});
      }
      if(request.method==="POST"&&path==="/v1/inventory/issues"){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        await inventory.issue(context.tenantId,user.id,accessToken,await readJsonObject(request));
        return new Response(null,{status:204});
      }
      if(request.method==="POST"&&path==="/v1/inventory/returns"){
        const {user,context}=await resolveTenantRequest(request);
        await inventory.returnOwn(context.tenantId,user.id,await readJsonObject(request));
        return new Response(null,{status:204});
      }
      const distributions=/^\/v1\/visits\/([^/]+)\/distributions$/.exec(path);
      if(distributions){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET"){
          return json(200,{distributions:await inventory.listVisitDistributions(context.tenantId,accessToken,distributions[1])});
        }
        if(request.method==="POST"){
          return json(200,{distributions:await inventory.distribute(
            context.tenantId,user.id,accessToken,distributions[1],await readJsonObject(request,32_768)
          )});
        }
      }

      if(request.method==="GET"&&path==="/v1/dcrs"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{dcrs:await doctorCalls.listDcrs(context.tenantId,accessToken)});
      }
      const dcrMatch=/^\/v1\/dcrs\/([^/]+)$/.exec(path);
      if(request.method==="GET"&&dcrMatch){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{dcr:await doctorCalls.getDcr(context.tenantId,accessToken,dcrMatch[1])});
      }
      const doctorCallMatch=/^\/v1\/visits\/([^/]+)\/doctor-call$/.exec(path);
      if(doctorCallMatch){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET"){
          return json(200,{doctorCall:await doctorCalls.getByVisit(context.tenantId,accessToken,doctorCallMatch[1])});
        }
        if(request.method==="PUT"){
          return json(200,{doctorCall:await doctorCalls.save(
            context.tenantId,user.id,accessToken,doctorCallMatch[1],await readJsonObject(request,32_768)
          )});
        }
      }

      if (request.method === "GET" && path === "/v1/field-settings") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{settings:await visits.getSettings(context.tenantId,accessToken)});
      }
      if (request.method === "PUT" && path === "/v1/field-settings") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{settings:await visits.updateSettings(context.tenantId,accessToken,await readJsonObject(request))});
      }
      if (request.method === "GET" && path === "/v1/visits/open") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{visit:await visits.getOpen(context.tenantId,accessToken)});
      }
      if (request.method === "POST" && path === "/v1/visits/check-in") {
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{visit:await visits.checkIn(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }
      const checkout=/^\/v1\/visits\/([^/]+)\/check-out$/.exec(path);
      if(request.method==="POST"&&checkout){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(200,{visit:await visits.checkOut(context.tenantId,user.id,accessToken,checkout[1],await readJsonObject(request))});
      }
      const presence=/^\/v1\/visits\/([^/]+)\/presence$/.exec(path);
      if(presence){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        if(request.method==="GET")return json(200,{presence:await visits.getPresence(context.tenantId,accessToken,presence[1])});
        if(request.method==="POST")return json(201,{presence:await visits.recordDeparture(
          context.tenantId,user.id,accessToken,presence[1],await readJsonObject(request,32_768)
        )});
      }
      if(request.method==="GET"&&path==="/v1/visit-exceptions"){
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{exceptions:await visits.listPendingExceptions(context.tenantId,accessToken)});
      }
      const exceptionDecision=/^\/v1\/visit-exceptions\/([^/]+)\/decision$/.exec(path);
      if(request.method==="POST"&&exceptionDecision){
        const {accessToken,user,context}=await resolveTenantRequest(request);
        await visits.decideException(context.tenantId,user.id,accessToken,exceptionDecision[1],await readJsonObject(request));
        return new Response(null,{status:204});
      }

      if (request.method === "GET" && path === "/v1/tour-executions/progress") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{progress:await tourProgress.getCurrent(context.tenantId,accessToken)});
      }

      if (request.method === "GET" && path === "/v1/tour-executions/start-options") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{options:await tourExecution.listStartOptions(context.tenantId,accessToken)});
      }
      if (request.method === "GET" && path === "/v1/tour-executions/active") {
        const {accessToken,context}=await resolveTenantRequest(request);
        return json(200,{execution:await tourExecution.getActive(context.tenantId,accessToken)});
      }
      if (request.method === "POST" && path === "/v1/tour-executions/start") {
        const {accessToken,user,context}=await resolveTenantRequest(request);
        return json(201,{execution:await tourExecution.start(context.tenantId,user.id,accessToken,await readJsonObject(request))});
      }

      if (request.method === "GET" && path === "/v1/tour-approvals") {
        const { accessToken, context }=await resolveTenantRequest(request);
        return json(200,{plans:await tourApproval.listPending(context.tenantId,accessToken)});
      }

      const approvalDecision=/^\/v1\/tour-approvals\/([^/]+)\/decision$/.exec(path);
      if (request.method === "POST" && approvalDecision) {
        const { accessToken,user,context }=await resolveTenantRequest(request);
        await tourApproval.decide(
          context.tenantId,user.id,approvalDecision[1],accessToken,await readJsonObject(request)
        );
        return new Response(null,{status:204});
      }

      const approvalPlan=/^\/v1\/tour-approvals\/([^/]+)$/.exec(path);
      if (request.method === "GET" && approvalPlan) {
        const { accessToken,context }=await resolveTenantRequest(request);
        return json(200,{plan:await tourApproval.get(context.tenantId,approvalPlan[1],accessToken)});
      }

      if (request.method === "GET" && path === "/v1/tour-plans") {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        return json(200, {
          plans: await tourPlanning.list(context.tenantId, user.id, accessToken),
        });
      }

      if (request.method === "POST" && path === "/v1/tour-plans") {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        const plan = await tourPlanning.save(
          context.tenantId,
          user.id,
          null,
          accessToken,
          await readJsonObject(request, 65_536),
        );
        return json(201, { plan });
      }

      const submitMatch = /^\/v1\/tour-plans\/([^/]+)\/submit$/.exec(path);
      if (request.method === "POST" && submitMatch) {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        await tourPlanning.submit(context.tenantId, user.id, submitMatch[1], accessToken);
        return new Response(null, { status: 204 });
      }

      const planMatch = /^\/v1\/tour-plans\/([^/]+)$/.exec(path);
      if (planMatch) {
        const { accessToken, user, context } = await resolveTenantRequest(request);
        if (request.method === "GET") {
          return json(200, {
            plan: await tourPlanning.get(context.tenantId, user.id, planMatch[1], accessToken),
          });
        }
        if (request.method === "PUT") {
          const plan = await tourPlanning.save(
            context.tenantId,
            user.id,
            planMatch[1],
            accessToken,
            await readJsonObject(request, 65_536),
          );
          return json(200, { plan });
        }
      }

      const masterMatch = /^\/v1\/masters\/([^/]+)$/.exec(path);
      if (masterMatch && MASTER_KINDS.includes(masterMatch[1] as MasterKind)) {
        const kind = masterMatch[1] as MasterKind;
        const { accessToken, context } = await resolveTenantRequest(request);
        if (request.method === "GET") {
          return json(200, { items: await masters.list(kind, context.tenantId, accessToken) });
        }
        if (request.method === "POST") {
          const item = await masters.create(
            kind,
            context.tenantId,
            accessToken,
            await readJsonObject(request),
          );
          return json(201, { item });
        }
      }

      if (request.method === "POST" && path === "/v1/role-assignments") {
        const { accessToken, context } = await resolveTenantRequest(request);
        await rbac.assignRole(context.tenantId, accessToken, await readJsonObject(request));
        return new Response(null, { status: 204 });
      }

      return json(404, { error: "Not found" });
    } catch (error) {
      return mapError(error);
    }
  };
}
