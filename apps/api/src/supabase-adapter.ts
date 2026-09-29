import type { AuthProvider, AuthSession, AuthUser } from "../../../modules/identity/src/index.ts";
import type { TenantRepository, TenantSummary } from "../../../modules/tenant/src/index.ts";
import type { OrgUnit, OrganizationRepository } from "../../../modules/organization/src/index.ts";
import type { MasterKind, MasterRecord, MastersRepository } from "../../../modules/masters/src/index.ts";
import type { TourPlan, TourPlanningRepository, TourPlanStop, TourPlanSummary } from "../../../modules/tour-planning/src/index.ts";
import type { TourApprovalRepository } from "../../../modules/tour-approval/src/index.ts";
import type { StartTourOption, TourExecution, TourExecutionRepository } from "../../../modules/tour-execution/src/index.ts";
import type { TourProgress, TourProgressRepository } from "../../../modules/tour-progress/src/index.ts";
import type { FieldSettings, Visit, VisitRepository } from "../../../modules/visit-execution/src/index.ts";
import type { Dcr, DcrSummary, DoctorCall, DoctorCallRepository } from "../../../modules/doctor-call/src/index.ts";
import type { InventoryBalance, InventoryRepository, VisitDistribution } from "../../../modules/inventory/src/index.ts";
import type { SubmitTourRepository, SubmitTourResult } from "../../../modules/tour-submit/src/index.ts";
import type { DailyTimesheet, DailyTimesheetRepository } from "../../../modules/timesheet-daily/src/index.ts";
import type { WeeklyTimesheet, WeeklyTimesheetRepository } from "../../../modules/timesheet-weekly/src/index.ts";
import type { TradeCall, TradeCallRepository } from "../../../modules/trade-call/src/index.ts";
import type { RcpaReport, RcpaRepository } from "../../../modules/rcpa/src/index.ts";
import type { OrderRepository, SalesOrder } from "../../../modules/orders/src/index.ts";
import type {
  OrgAssignmentSummary,
  PermissionKey,
  RbacRepository,
  RoleAssignment,
  RoleKey,
} from "../../../modules/rbac/src/index.ts";

type Fetcher = typeof fetch;

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

type SupabaseSessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SupabaseAuthUser;
};

type MembershipRow = {
  tenant: TenantSummary | TenantSummary[] | null;
};

type OrgUnitRow = {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  type: OrgUnit["type"];
  code: string;
  name: string;
  status: OrgUnit["status"];
};

export class ProviderError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { msg?: string; message?: string; error_description?: string };
    return body.message ?? body.msg ?? body.error_description ?? "Provider request failed";
  } catch {
    return "Provider request failed";
  }
}

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) throw new ProviderError(await readError(response), response.status);
  return response;
}

async function expectSignInOk(response: Response): Promise<Response> {
  if (!response.ok) {
    const status = response.status >= 400 && response.status < 500 ? 401 : response.status;
    throw new ProviderError(await readError(response), status);
  }
  return response;
}

function authHeaders(config: SupabaseConfig, accessToken?: string): HeadersInit {
  return {
    apikey: config.anonKey,
    "content-type": "application/json",
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

function adminHeaders(config: SupabaseConfig, prefer?: string): HeadersInit {
  if (!config.serviceRoleKey) throw new ProviderError("Server provider key is not configured", 500);
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

function mapOrgUnit(row: OrgUnitRow): OrgUnit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    parentId: row.parent_id,
    type: row.type,
    code: row.code,
    name: row.name,
    status: row.status,
  };
}

export function createSupabaseAdapter(
  config: SupabaseConfig,
  fetcher: Fetcher = fetch,
): {
  auth: AuthProvider;
  tenants: TenantRepository;
  organization: OrganizationRepository;
  rbac: RbacRepository;
  masters: MastersRepository;
  tourPlanning: TourPlanningRepository;
  tourApproval: TourApprovalRepository;
  tourExecution: TourExecutionRepository;
  tourProgress: TourProgressRepository;
  visits: VisitRepository;
  doctorCalls: DoctorCallRepository;
  inventory: InventoryRepository;
  tourSubmit: SubmitTourRepository;
  dailyTimesheets: DailyTimesheetRepository;
  weeklyTimesheets: WeeklyTimesheetRepository;
  tradeCalls: TradeCallRepository;
  rcpa: RcpaRepository;
  orders: OrderRepository;
} {
  const base = config.url.replace(/\/+$/, "");

  const auth: AuthProvider = {
    async signIn(email, password): Promise<AuthSession> {
      const response = await expectSignInOk(await fetcher(`${base}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify({ email, password }),
      }));
      const body = await response.json() as SupabaseSessionResponse;
      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresIn: body.expires_in,
        user: { id: body.user.id, email: body.user.email ?? null },
      };
    },

    async refreshSession(refreshToken): Promise<AuthSession> {
      const response = await expectSignInOk(await fetcher(`${base}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify({ refresh_token: refreshToken }),
      }));
      const body = await response.json() as SupabaseSessionResponse;
      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresIn: body.expires_in,
        user: { id: body.user.id, email: body.user.email ?? null },
      };
    },

    async getUser(accessToken): Promise<AuthUser> {
      const response = await expectOk(await fetcher(`${base}/auth/v1/user`, {
        headers: authHeaders(config, accessToken),
      }));
      const user = await response.json() as SupabaseAuthUser;
      return { id: user.id, email: user.email ?? null };
    },

    async requestPasswordReset(email) {
      await expectOk(await fetcher(`${base}/auth/v1/recover`, {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify({ email }),
      }));
    },

    async signOut(accessToken) {
      await expectOk(await fetcher(`${base}/auth/v1/logout`, {
        method: "POST",
        headers: authHeaders(config, accessToken),
      }));
    },
  };

  const tenants: TenantRepository = {
    async listAccessible(accessToken) {
      const query = new URLSearchParams({
        select: "tenant:tenants!inner(id,name,slug,status)",
        status: "eq.active",
        "tenant.status": "eq.active",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/tenant_memberships?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      const rows = await response.json() as MembershipRow[];
      return rows.flatMap((row) => {
        const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
        return tenant ? [tenant] : [];
      });
    },

    async hasActiveAccess(tenantId, accessToken) {
      const query = new URLSearchParams({
        select: "id",
        id: `eq.${tenantId}`,
        status: "eq.active",
        limit: "1",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/tenants?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      const rows = await response.json() as Array<{ id: string }>;
      return rows.length === 1;
    },
  };

  const organization: OrganizationRepository = {
    async listUnits(tenantId, accessToken) {
      const query = new URLSearchParams({
        select: "id,tenant_id,parent_id,type,code,name,status",
        tenant_id: `eq.${tenantId}`,
        status: "eq.active",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/organization_units?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      return (await response.json() as OrgUnitRow[]).map(mapOrgUnit);
    },

    async getUnit(tenantId, orgUnitId, accessToken) {
      const query = new URLSearchParams({
        select: "id,tenant_id,parent_id,type,code,name,status",
        tenant_id: `eq.${tenantId}`,
        id: `eq.${orgUnitId}`,
        status: "eq.active",
        limit: "1",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/organization_units?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      const rows = await response.json() as OrgUnitRow[];
      return rows[0] ? mapOrgUnit(rows[0]) : null;
    },

    async createUnit(tenantId, input) {
      const response = await expectOk(await fetcher(`${base}/rest/v1/organization_units`, {
        method: "POST",
        headers: adminHeaders(config, "return=representation"),
        body: JSON.stringify({
          tenant_id: tenantId,
          parent_id: input.parentId,
          type: input.type,
          code: input.code,
          name: input.name,
        }),
      }));
      const rows = await response.json() as OrgUnitRow[];
      if (!rows[0]) throw new ProviderError("Provider returned no organization unit", 502);
      return mapOrgUnit(rows[0]);
    },

    async assignUser(tenantId, input) {
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_assign_user_org`, {
        method: "POST",
        headers: adminHeaders(config),
        body: JSON.stringify({
          p_tenant_id: tenantId,
          p_user_id: input.userId,
          p_org_unit_id: input.orgUnitId,
          p_is_primary: input.isPrimary,
        }),
      }));
    },
  };

  const rbac: RbacRepository = {
    async hasPermission(tenantId, permission, targetOrgUnitId, accessToken) {
      const response = await expectOk(await fetcher(`${base}/rest/v1/rpc/has_permission`, {
        method: "POST",
        headers: authHeaders(config, accessToken),
        body: JSON.stringify({
          p_tenant_id: tenantId,
          p_permission: permission,
          p_target_unit_id: targetOrgUnitId,
        }),
      }));
      return await response.json() as boolean;
    },

    async listOwnRoleAssignments(tenantId, userId, accessToken): Promise<RoleAssignment[]> {
      const query = new URLSearchParams({
        select: "role_key,scope_org_unit_id",
        tenant_id: `eq.${tenantId}`,
        user_id: `eq.${userId}`,
        status: "eq.active",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/user_role_assignments?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      const rows = await response.json() as Array<{ role_key: RoleKey; scope_org_unit_id: string | null }>;
      return rows.map((row) => ({ roleKey: row.role_key, scopeOrgUnitId: row.scope_org_unit_id }));
    },

    async listPermissions(roleKeys, accessToken): Promise<PermissionKey[]> {
      if (roleKeys.length === 0) return [];
      const query = new URLSearchParams({
        select: "role_key,permission_key",
        role_key: `in.(${roleKeys.join(",")})`,
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/role_permissions?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      const rows = await response.json() as Array<{ role_key: RoleKey; permission_key: PermissionKey }>;
      return rows.map((row) => row.permission_key);
    },

    async listOwnOrgAssignments(tenantId, userId, accessToken): Promise<OrgAssignmentSummary[]> {
      const query = new URLSearchParams({
        select: "org_unit_id,is_primary",
        tenant_id: `eq.${tenantId}`,
        user_id: `eq.${userId}`,
        status: "eq.active",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/user_org_assignments?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      const rows = await response.json() as Array<{ org_unit_id: string; is_primary: boolean }>;
      return rows.map((row) => ({ orgUnitId: row.org_unit_id, isPrimary: row.is_primary }));
    },

    async assignRole(tenantId, input) {
      await expectOk(await fetcher(`${base}/rest/v1/user_role_assignments`, {
        method: "POST",
        headers: adminHeaders(config),
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: input.userId,
          role_key: input.roleKey,
          scope_org_unit_id: input.scopeOrgUnitId,
        }),
      }));
    },
  };

  const masterTables: Record<MasterKind, string> = {
    employees: "employees",
    doctors: "doctors",
    products: "products",
    chemists: "chemists",
    stockists: "stockists",
    samples: "samples",
    gifts: "gifts",
  };

  const toCamel = (row: Record<string, unknown>): MasterRecord => {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      mapped[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
    }
    return mapped as MasterRecord;
  };

  const toSnake = (input: Record<string, unknown>) => Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ]),
  );

  const masters: MastersRepository = {
    async list(kind, tenantId, accessToken) {
      const query = new URLSearchParams({
        select: "*",
        tenant_id: `eq.${tenantId}`,
        status: "eq.active",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/${masterTables[kind]}?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      return (await response.json() as Array<Record<string, unknown>>).map(toCamel);
    },

    async get(kind, tenantId, id, accessToken) {
      const query = new URLSearchParams({
        select: "*",
        tenant_id: `eq.${tenantId}`,
        id: `eq.${id}`,
        status: "eq.active",
        limit: "1",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/${masterTables[kind]}?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      const rows = await response.json() as Array<Record<string, unknown>>;
      return rows[0] ? toCamel(rows[0]) : null;
    },

    async create(kind, tenantId, input) {
      const response = await expectOk(await fetcher(`${base}/rest/v1/${masterTables[kind]}`, {
        method: "POST",
        headers: adminHeaders(config, "return=representation"),
        body: JSON.stringify({ tenant_id: tenantId, ...toSnake(input) }),
      }));
      const rows = await response.json() as Array<Record<string, unknown>>;
      if (!rows[0]) throw new ProviderError("Provider returned no master record", 502);
      return toCamel(rows[0]);
    },
  };

  type TourPlanRow = {
    id: string;
    week_start: string;
    status: TourPlan["status"];
    submitted_at: string | null;
  };
  type TourDayRow = {
    id: string;
    plan_date: string;
    territory_id: string;
    remarks: string | null;
  };
  type TourStopRow = {
    tour_plan_day_id: string;
    sequence_no: number;
    stop_type: TourPlanStop["type"];
    doctor_id: string | null;
    chemist_id: string | null;
    stockist_id: string | null;
    remarks: string | null;
  };

  const mapStop = (row: TourStopRow): TourPlanStop => ({
    sequence: row.sequence_no,
    type: row.stop_type,
    targetId: row.doctor_id ?? row.chemist_id ?? row.stockist_id ?? "",
    remarks: row.remarks,
  });

  const tourPlanning: TourPlanningRepository = {
    async listOwn(tenantId, _userId, accessToken): Promise<TourPlanSummary[]> {
      const query = new URLSearchParams({
        select: "id,week_start,status,submitted_at",
        tenant_id: `eq.${tenantId}`,
        order: "week_start.desc",
      });
      const response = await expectOk(await fetcher(`${base}/rest/v1/tour_plans?${query}`, {
        headers: authHeaders(config, accessToken),
      }));
      return (await response.json() as TourPlanRow[]).map((row) => ({
        id: row.id,
        weekStart: row.week_start,
        status: row.status,
        submittedAt: row.submitted_at,
      }));
    },

    async getOwn(tenantId, _userId, planId, accessToken): Promise<TourPlan | null> {
      const planQuery = new URLSearchParams({
        select: "id,week_start,status,submitted_at",
        tenant_id: `eq.${tenantId}`,
        id: `eq.${planId}`,
        limit: "1",
      });
      const planResponse = await expectOk(await fetcher(`${base}/rest/v1/tour_plans?${planQuery}`, {
        headers: authHeaders(config, accessToken),
      }));
      const planRows = await planResponse.json() as TourPlanRow[];
      const plan = planRows[0];
      if (!plan) return null;

      const dayQuery = new URLSearchParams({
        select: "id,plan_date,territory_id,remarks",
        tenant_id: `eq.${tenantId}`,
        tour_plan_id: `eq.${planId}`,
        order: "plan_date.asc",
      });
      const dayResponse = await expectOk(await fetcher(`${base}/rest/v1/tour_plan_days?${dayQuery}`, {
        headers: authHeaders(config, accessToken),
      }));
      const dayRows = await dayResponse.json() as TourDayRow[];

      let stopRows: TourStopRow[] = [];
      if (dayRows.length > 0) {
        const stopQuery = new URLSearchParams({
          select: "tour_plan_day_id,sequence_no,stop_type,doctor_id,chemist_id,stockist_id,remarks",
          tenant_id: `eq.${tenantId}`,
          tour_plan_day_id: `in.(${dayRows.map((day) => day.id).join(",")})`,
          order: "sequence_no.asc",
        });
        const stopResponse = await expectOk(await fetcher(`${base}/rest/v1/tour_plan_stops?${stopQuery}`, {
          headers: authHeaders(config, accessToken),
        }));
        stopRows = await stopResponse.json() as TourStopRow[];
      }

      return {
        id: plan.id,
        weekStart: plan.week_start,
        status: plan.status,
        submittedAt: plan.submitted_at,
        days: dayRows.map((day) => ({
          date: day.plan_date,
          territoryId: day.territory_id,
          remarks: day.remarks,
          stops: stopRows
            .filter((stop) => stop.tour_plan_day_id === day.id)
            .map(mapStop),
        })),
      };
    },

    async save(tenantId, userId, planId, weekStart, days) {
      const response = await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_save_tour_plan`, {
        method: "POST",
        headers: adminHeaders(config),
        body: JSON.stringify({
          p_tenant_id: tenantId,
          p_user_id: userId,
          p_plan_id: planId,
          p_week_start: weekStart,
          p_days: days,
        }),
      }));
      return await response.json() as string;
    },

    async submit(tenantId, userId, planId) {
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_submit_tour_plan`, {
        method: "POST",
        headers: adminHeaders(config),
        body: JSON.stringify({
          p_tenant_id: tenantId,
          p_user_id: userId,
          p_plan_id: planId,
        }),
      }));
    },
  };

  const tourApproval: TourApprovalRepository = {
    async listPending(tenantId, accessToken) {
      const query=new URLSearchParams({
        select:"id,week_start,status,submitted_at",
        tenant_id:`eq.${tenantId}`,
        status:"eq.SUBMITTED",
        order:"submitted_at.asc",
      });
      const response=await expectOk(await fetcher(`${base}/rest/v1/tour_plans?${query}`,{
        headers:authHeaders(config,accessToken),
      }));
      return (await response.json() as TourPlanRow[]).map((row)=>({
        id:row.id,weekStart:row.week_start,status:row.status,submittedAt:row.submitted_at,
      }));
    },
    async getForReview(tenantId, planId, accessToken) {
      return tourPlanning.getOwn(tenantId,"",planId,accessToken);
    },
    async decide(tenantId,actorUserId,planId,decision,comment) {
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_decide_tour_plan`,{
        method:"POST",
        headers:adminHeaders(config),
        body:JSON.stringify({
          p_tenant_id:tenantId,p_actor_user_id:actorUserId,p_plan_id:planId,
          p_decision:decision,p_comment:comment,
        }),
      }));
    },
  };

  const mapExecution=(row:Record<string,any>):TourExecution=>({
    id:row.id,operationId:row.operation_id,planId:row.tour_plan_id,planDayId:row.tour_plan_day_id,
    workDate:row.work_date,territoryId:row.territory_id,status:row.status,startedAt:row.started_at,
    deviceStartedAt:row.device_started_at,requiredMinutes:row.required_minutes,
    startLatitude:row.start_latitude,startLongitude:row.start_longitude,startAccuracyMeters:row.start_accuracy_meters,
    deviceId:row.device_id,networkType:row.network_type,appVersion:row.app_version,
  });

  const tourExecution:TourExecutionRepository={
    async listStartOptions(tenantId,accessToken){
      const response=await expectOk(await fetcher(`${base}/rest/v1/rpc/my_start_tour_options`,{
        method:"POST",headers:authHeaders(config,accessToken),body:JSON.stringify({p_tenant_id:tenantId}),
      }));
      return (await response.json() as Array<Record<string,any>>).map((row):StartTourOption=>({
        planId:row.plan_id,planDayId:row.plan_day_id,workDate:row.work_date,territoryId:row.territory_id,
      }));
    },
    async getActive(tenantId,accessToken){
      const query=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,status:"eq.ACTIVE",limit:"1"});
      const response=await expectOk(await fetcher(`${base}/rest/v1/tour_executions?${query}`,{headers:authHeaders(config,accessToken)}));
      const rows=await response.json() as Array<Record<string,any>>;
      return rows[0]?mapExecution(rows[0]):null;
    },
    async start(tenantId,userId,command){
      const response=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_start_tour`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_operation_id:command.operationId,p_plan_day_id:command.planDayId,
          p_device_started_at:command.deviceStartedAt,p_latitude:command.latitude,p_longitude:command.longitude,
          p_accuracy_meters:command.accuracyMeters,p_device_id:command.deviceId,p_network_type:command.networkType,
          p_app_version:command.appVersion,
        }),
      }));
      return await response.json() as string;
    },
  };

  const tourProgress:TourProgressRepository={
    async getCurrent(tenantId,accessToken){
      const response=await expectOk(await fetcher(`${base}/rest/v1/rpc/my_active_tour_progress`,{
        method:"POST",headers:authHeaders(config,accessToken),body:JSON.stringify({p_tenant_id:tenantId}),
      }));
      return await response.json() as TourProgress|null;
    },
  };

  const mapVisit=(row:Record<string,any>):Visit=>({
    id:row.id,executionId:row.execution_id,planStopId:row.plan_stop_id,territoryId:row.territory_id,
    status:row.status,verification:row.verification,exceptionStatus:row.exception_status,
    distanceMeters:row.distance_meters,geofenceRadiusMeters:row.geofence_radius_meters,
    checkinAt:row.checkin_at,checkoutAt:row.checkout_at,
  });

  const visits:VisitRepository={
    async getSettings(tenantId,accessToken){
      const query=new URLSearchParams({select:"geofence_radius_meters,max_gps_accuracy_meters",id:`eq.${tenantId}`,limit:"1"});
      const response=await expectOk(await fetcher(`${base}/rest/v1/tenants?${query}`,{headers:authHeaders(config,accessToken)}));
      const row=(await response.json() as Array<Record<string,any>>)[0];
      if(!row)throw new ProviderError("Tenant settings unavailable",404);
      return {geofenceRadiusMeters:row.geofence_radius_meters,maxGpsAccuracyMeters:row.max_gps_accuracy_meters} as FieldSettings;
    },
    async updateSettings(tenantId,settings){
      await expectOk(await fetcher(`${base}/rest/v1/tenants?id=eq.${tenantId}`,{
        method:"PATCH",headers:adminHeaders(config),body:JSON.stringify({
          geofence_radius_meters:settings.geofenceRadiusMeters,max_gps_accuracy_meters:settings.maxGpsAccuracyMeters,
        }),
      }));
    },
    async checkIn(tenantId,userId,input){
      const response=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_checkin_visit`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_operation_id:input.operationId,p_plan_stop_id:input.planStopId,
          p_latitude:input.latitude,p_longitude:input.longitude,p_accuracy_meters:input.accuracyMeters,
          p_exception_reason:input.exceptionReason,
        }),
      }));
      return await response.json() as string;
    },
    async getOpen(tenantId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,status:"eq.CHECKED_IN",limit:"1"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/field_visits?${q}`,{headers:authHeaders(config,accessToken)}));
      const rows=await r.json() as Array<Record<string,any>>;return rows[0]?mapVisit(rows[0]):null;
    },
    async getById(tenantId,visitId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,id:`eq.${visitId}`,limit:"1"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/field_visits?${q}`,{headers:authHeaders(config,accessToken)}));
      const rows=await r.json() as Array<Record<string,any>>;return rows[0]?mapVisit(rows[0]):null;
    },
    async checkOut(tenantId,userId,visitId,input){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_checkout_visit`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_visit_id:visitId,p_operation_id:input.operationId,
          p_latitude:input.latitude,p_longitude:input.longitude,p_accuracy_meters:input.accuracyMeters,
        }),
      }));
    },
    async listPendingExceptions(tenantId,accessToken){
      const q=new URLSearchParams({select:"*,tour_executions!inner(tour_plan_id)",tenant_id:`eq.${tenantId}`,exception_status:"eq.PENDING"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/field_visits?${q}`,{headers:authHeaders(config,accessToken)}));
      return (await r.json() as Array<Record<string,any>>).map((row)=>({...mapVisit(row),planId:(row.tour_executions as any)?.tour_plan_id}));
    },
    async decideException(tenantId,actorUserId,visitId,decision,comment){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_review_visit_exception`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_actor_user_id:actorUserId,p_visit_id:visitId,p_decision:decision,p_comment:comment,
        }),
      }));
    },
  };

  const mapDoctorCall=(row:Record<string,any>,details:Array<Record<string,any>>):DoctorCall=>({
    id:row.id,visitId:row.visit_id,doctorId:row.doctor_id,callOutcome:row.call_outcome,
    remarks:row.remarks,nextAction:row.next_action,updatedAt:row.updated_at,
    products:details.map((detail)=>({
      sequence:detail.sequence_no,productId:detail.product_id,detailNotes:detail.detail_notes,
    })),
  });
  const mapDcrSummary=(row:Record<string,any>):DcrSummary=>({
    id:row.id,visitId:row.visit_id,executionId:row.execution_id,doctorId:row.doctor_id,
    doctorCode:row.doctor_code,doctorName:row.doctor_name,status:row.status,
    callOutcome:row.call_outcome,remarks:row.remarks,nextAction:row.next_action,
    callStartedAt:row.call_started_at,callEndedAt:row.call_ended_at,submittedAt:row.submitted_at,
    gpsVerification:row.gps_verification,gpsExceptionStatus:row.gps_exception_status,
  });
  const doctorCalls:DoctorCallRepository={
    async save(tenantId,userId,visitId,input){
      const response=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_save_doctor_call`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_visit_id:visitId,p_operation_id:input.operationId,
          p_call_outcome:input.callOutcome,p_remarks:input.remarks,p_next_action:input.nextAction,
          p_products:input.products,
        }),
      }));
      return await response.json() as string;
    },
    async getByVisit(tenantId,visitId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,visit_id:`eq.${visitId}`,limit:"1"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/doctor_calls?${q}`,{headers:authHeaders(config,accessToken)}));
      const rows=await r.json() as Array<Record<string,any>>;
      if(!rows[0])return null;
      const dq=new URLSearchParams({select:"sequence_no,product_id,detail_notes",tenant_id:`eq.${tenantId}`,doctor_call_id:`eq.${rows[0].id}`,order:"sequence_no.asc"});
      const dr=await expectOk(await fetcher(`${base}/rest/v1/doctor_call_products?${dq}`,{headers:authHeaders(config,accessToken)}));
      return mapDoctorCall(rows[0],await dr.json() as Array<Record<string,any>>);
    },
    async listDcrs(tenantId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,order:"submitted_at.desc"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/dcrs?${q}`,{headers:authHeaders(config,accessToken)}));
      return (await r.json() as Array<Record<string,any>>).map(mapDcrSummary);
    },
    async getDcr(tenantId,dcrId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,id:`eq.${dcrId}`,limit:"1"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/dcrs?${q}`,{headers:authHeaders(config,accessToken)}));
      const rows=await r.json() as Array<Record<string,any>>;
      if(!rows[0])return null;
      const pq=new URLSearchParams({select:"sequence_no,product_id,product_code,product_name,detail_notes",tenant_id:`eq.${tenantId}`,dcr_id:`eq.${dcrId}`,order:"sequence_no.asc"});
      const pr=await expectOk(await fetcher(`${base}/rest/v1/dcr_products?${pq}`,{headers:authHeaders(config,accessToken)}));
      const distributionsQuery=new URLSearchParams({
        select:"item_type,sample_id,gift_id,item_code,item_name,quantity",
        tenant_id:`eq.${tenantId}`,dcr_id:`eq.${dcrId}`,order:"id.asc",
      });
      const distributionsResponse=await expectOk(await fetcher(`${base}/rest/v1/dcr_distributions?${distributionsQuery}`,{
        headers:authHeaders(config,accessToken),
      }));
      return {
        ...mapDcrSummary(rows[0]),
        products:(await pr.json() as Array<Record<string,any>>).map((item)=>({
          sequence:item.sequence_no,productId:item.product_id,productCode:item.product_code,
          productName:item.product_name,detailNotes:item.detail_notes,
        })),
        distributions:(await distributionsResponse.json() as Array<Record<string,any>>).map((item)=>({
          itemType:item.item_type,itemId:item.sample_id??item.gift_id,itemCode:item.item_code,
          itemName:item.item_name,quantity:item.quantity,
        })),
      } as Dcr;
    },
  };

  const mapBalance=(row:Record<string,any>):InventoryBalance=>({
    id:row.id,employeeId:row.employee_id,itemType:row.item_type,
    itemId:row.sample_id??row.gift_id,quantity:row.quantity,
  });
  const mapDistribution=(row:Record<string,any>):VisitDistribution=>({
    id:row.id,visitId:row.visit_id,itemType:row.sample_id?"sample":"gift",
    itemId:row.sample_id??row.gift_id,quantity:row.quantity,createdAt:row.created_at,
  });
  const inventory:InventoryRepository={
    async listBalances(tenantId,accessToken){
      const q=new URLSearchParams({select:"id,employee_id,item_type,sample_id,gift_id,quantity",tenant_id:`eq.${tenantId}`,order:"employee_id.asc"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/inventory_balances?${q}`,{headers:authHeaders(config,accessToken)}));
      return (await r.json() as Array<Record<string,any>>).map(mapBalance);
    },
    async issue(tenantId,actorUserId,input){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_issue_inventory`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_actor_user_id:actorUserId,p_operation_id:input.operationId,
          p_employee_id:input.employeeId,p_item_type:input.itemType,p_item_id:input.itemId,p_quantity:input.quantity,
        }),
      }));
    },
    async returnOwn(tenantId,userId,input){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_return_inventory`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_operation_id:input.operationId,
          p_item_type:input.itemType,p_item_id:input.itemId,p_quantity:input.quantity,
        }),
      }));
    },
    async distribute(tenantId,userId,visitId,input){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_distribute_visit_inventory`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_visit_id:visitId,p_operation_id:input.operationId,
          p_items:input.items,
        }),
      }));
    },
    async listVisitDistributions(tenantId,visitId,accessToken){
      const q=new URLSearchParams({
        select:"id,visit_id,sample_id,gift_id,quantity,created_at",
        tenant_id:`eq.${tenantId}`,visit_id:`eq.${visitId}`,order:"created_at.asc",
      });
      const r=await expectOk(await fetcher(`${base}/rest/v1/visit_distributions?${q}`,{headers:authHeaders(config,accessToken)}));
      return (await r.json() as Array<Record<string,any>>).map(mapDistribution);
    },
  };

  const tourSubmit:SubmitTourRepository={
    async submit(tenantId,userId,input){
      const response=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_submit_tour_execution`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_operation_id:input.operationId,
          p_short_day_reason:input.shortDayReason,
        }),
      }));
      return await response.json() as string;
    },
    async getSubmitted(tenantId,executionId,accessToken){
      const q=new URLSearchParams({
        select:"id,status,started_at,submitted_at,required_minutes,worked_minutes,short_day_reason",
        tenant_id:`eq.${tenantId}`,id:`eq.${executionId}`,status:"eq.SUBMITTED",limit:"1",
      });
      const r=await expectOk(await fetcher(`${base}/rest/v1/tour_executions?${q}`,{headers:authHeaders(config,accessToken)}));
      const row=(await r.json() as Array<Record<string,any>>)[0];
      if(!row)return null;
      return {
        id:row.id,status:row.status,startedAt:row.started_at,submittedAt:row.submitted_at,
        requiredMinutes:row.required_minutes,workedMinutes:row.worked_minutes,shortDayReason:row.short_day_reason,
      } as SubmitTourResult;
    },
  };

  const mapDailyTimesheet=(row:Record<string,any>):DailyTimesheet=>({
    id:row.id,executionId:row.execution_id,workDate:row.work_date,
    startedAt:row.started_at,submittedAt:row.submitted_at,totalMinutes:row.total_minutes,
    visitMinutes:row.visit_minutes,unclassifiedMinutes:row.unclassified_minutes,
    callCount:row.call_count,status:row.status,remarks:row.remarks,reviewedAt:row.reviewed_at,
  });
  const dailyTimesheets:DailyTimesheetRepository={
    async listOwn(tenantId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,order:"work_date.desc"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/daily_timesheets?${q}`,{headers:authHeaders(config,accessToken)}));
      return (await r.json() as Array<Record<string,any>>).map(mapDailyTimesheet);
    },
    async getOwn(tenantId,id,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,id:`eq.${id}`,limit:"1"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/daily_timesheets?${q}`,{headers:authHeaders(config,accessToken)}));
      const row=(await r.json() as Array<Record<string,any>>)[0];
      return row?mapDailyTimesheet(row):null;
    },
    async review(tenantId,userId,id,input){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_review_daily_timesheet`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_timesheet_id:id,p_operation_id:input.operationId,p_remarks:input.remarks,
        }),
      }));
    },
  };

  const mapWeekly=(row:Record<string,any>):WeeklyTimesheet=>{
    const employee=Array.isArray(row.employees)?row.employees[0]:row.employees;
    return {
      id:row.id,employeeId:row.employee_id,orgUnitId:employee?.org_unit_id??"",
      weekStart:row.week_start,status:row.status,dailyCount:row.daily_count,totalMinutes:row.total_minutes,
      visitMinutes:row.visit_minutes,unclassifiedMinutes:row.unclassified_minutes,callCount:row.call_count,
      submissionComment:row.submission_comment,submittedAt:row.submitted_at,
      reviewComment:row.review_comment,reviewedAt:row.reviewed_at,
    };
  };
  const weeklyTimesheets:WeeklyTimesheetRepository={
    async listVisible(tenantId,accessToken){
      const q=new URLSearchParams({select:"*,employees!inner(org_unit_id)",tenant_id:`eq.${tenantId}`,order:"week_start.desc"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/weekly_timesheets?${q}`,{headers:authHeaders(config,accessToken)}));
      return (await r.json() as Array<Record<string,any>>).map(mapWeekly);
    },
    async listPending(tenantId,accessToken){
      const q=new URLSearchParams({select:"*,employees!inner(org_unit_id)",tenant_id:`eq.${tenantId}`,status:"eq.SUBMITTED",order:"submitted_at.asc"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/weekly_timesheets?${q}`,{headers:authHeaders(config,accessToken)}));
      return (await r.json() as Array<Record<string,any>>).map(mapWeekly);
    },
    async getVisible(tenantId,id,accessToken){
      const q=new URLSearchParams({select:"*,employees!inner(org_unit_id)",tenant_id:`eq.${tenantId}`,id:`eq.${id}`,limit:"1"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/weekly_timesheets?${q}`,{headers:authHeaders(config,accessToken)}));
      const row=(await r.json() as Array<Record<string,any>>)[0];return row?mapWeekly(row):null;
    },
    async generate(tenantId,userId,week){
      const r=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_generate_weekly_timesheet`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({p_tenant_id:tenantId,p_user_id:userId,p_week_start:week}),
      }));return await r.json() as string;
    },
    async submit(tenantId,userId,id,input){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_submit_weekly_timesheet`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_timesheet_id:id,p_operation_id:input.operationId,p_comment:input.comment,
        }),
      }));
    },
    async decide(tenantId,actor,id,decision,comment){
      await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_decide_weekly_timesheet`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_actor_user_id:actor,p_timesheet_id:id,p_decision:decision,p_comment:comment,
        }),
      }));
    },
  };

  const mapTradeCall=(row:Record<string,any>):TradeCall=>({
    id:row.id,visitId:row.visit_id,callType:row.call_type,outcome:row.outcome,
    remarks:row.remarks,nextAction:row.next_action,updatedAt:row.updated_at,
  });
  const tradeCalls:TradeCallRepository={
    async save(tenantId,userId,visitId,input){
      const r=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_save_trade_call`,{
        method:"POST",headers:adminHeaders(config),body:JSON.stringify({
          p_tenant_id:tenantId,p_user_id:userId,p_visit_id:visitId,p_operation_id:input.operationId,
          p_outcome:input.outcome,p_remarks:input.remarks,p_next_action:input.nextAction,
        }),
      }));return await r.json() as string;
    },
    async getByVisit(tenantId,visitId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,visit_id:`eq.${visitId}`,limit:"1"});
      const r=await expectOk(await fetcher(`${base}/rest/v1/trade_calls?${q}`,{headers:authHeaders(config,accessToken)}));
      const row=(await r.json() as Array<Record<string,any>>)[0];return row?mapTradeCall(row):null;
    },
  };

  const rcpa:RcpaRepository={
    async save(tenantId,userId,visitId,input){const r=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_save_rcpa`,{method:"POST",headers:adminHeaders(config),body:JSON.stringify({p_tenant_id:tenantId,p_user_id:userId,p_visit_id:visitId,p_operation_id:input.operationId,p_lines:input.lines})}));return await r.json() as string;},
    async getByVisit(tenantId,visitId,accessToken){
      const q=new URLSearchParams({select:"*",tenant_id:`eq.${tenantId}`,visit_id:`eq.${visitId}`,limit:"1"});const r=await expectOk(await fetcher(`${base}/rest/v1/rcpa_reports?${q}`,{headers:authHeaders(config,accessToken)}));const row=(await r.json() as Array<Record<string,any>>)[0];if(!row)return null;
      const lq=new URLSearchParams({select:"sequence_no,product_id,competitor_brand,prescription_count,stock_quantity,sales_quantity",tenant_id:`eq.${tenantId}`,rcpa_report_id:`eq.${row.id}`,order:"sequence_no.asc"});const lr=await expectOk(await fetcher(`${base}/rest/v1/rcpa_lines?${lq}`,{headers:authHeaders(config,accessToken)}));
      return{id:row.id,visitId:row.visit_id,chemistId:row.chemist_id,updatedAt:row.updated_at,lines:(await lr.json() as Array<Record<string,any>>).map(x=>({sequence:x.sequence_no,productId:x.product_id,competitorBrand:x.competitor_brand,prescriptionCount:x.prescription_count,stockQuantity:x.stock_quantity,salesQuantity:x.sales_quantity}))} as RcpaReport;
    },
  };
  const orders:OrderRepository={async save(t,u,v,input){const r=await expectOk(await fetcher(`${base}/rest/v1/rpc/admin_save_sales_order`,{method:"POST",headers:adminHeaders(config),body:JSON.stringify({p_tenant_id:t,p_user_id:u,p_visit_id:v,p_operation_id:input.operationId,p_remarks:input.remarks,p_lines:input.lines})}));return await r.json() as string;},async getByVisit(t,v,token){const q=new URLSearchParams({select:"*",tenant_id:`eq.${t}`,visit_id:`eq.${v}`,limit:"1"});const r=await expectOk(await fetcher(`${base}/rest/v1/sales_orders?${q}`,{headers:authHeaders(config,token)}));const row=(await r.json() as Array<Record<string,any>>)[0];if(!row)return null;const lq=new URLSearchParams({select:"sequence_no,product_id,product_code,product_name,quantity,remarks",tenant_id:`eq.${t}`,sales_order_id:`eq.${row.id}`,order:"sequence_no.asc"});const lr=await expectOk(await fetcher(`${base}/rest/v1/sales_order_lines?${lq}`,{headers:authHeaders(config,token)}));return{id:row.id,visitId:row.visit_id,customerType:row.customer_type,customerId:row.chemist_id??row.stockist_id,customerCode:row.customer_code,customerName:row.customer_name,status:row.status,updatedAt:row.updated_at,lines:(await lr.json() as Array<Record<string,any>>).map(x=>({sequence:x.sequence_no,productId:x.product_id,productCode:x.product_code,productName:x.product_name,quantity:x.quantity,remarks:x.remarks}))} as SalesOrder;}};
  return { auth, tenants, organization, rbac, masters, tourPlanning, tourApproval, tourExecution, tourProgress, visits, doctorCalls, inventory, tourSubmit, dailyTimesheets, weeklyTimesheets, tradeCalls, rcpa, orders };
}
