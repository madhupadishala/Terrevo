/**
 * Terrevo web transport: ALL business calls use the existing authenticated, tenant-scoped API.
 * No service-role key, synthetic business data or bypass is exposed to the browser.
 */
export type UnplannedCall = {id:string;actorUserId:string;executionId:string;workDate:string;territoryId:string;
  customerType:"doctor"|"chemist"|"stockist";customerId:string;reason:string;remarks:string;
  durationMinutes:number;latitude:number;longitude:number;accuracyMeters:number;
  status:"SUBMITTED"|"APPROVED"|"REJECTED";managerComment:string|null;
  submittedAt:string;reviewedAt:string|null};
export type NcaCategory = {code:string;label:string;active:boolean};
export type NcaTown = {id:string;name:string;territoryId:string;active:boolean};
export type NcaOptions = {categories:NcaCategory[];towns:NcaTown[]};
export type NcaRecord = {id:string;workDate:string;territoryId:string;phase:"PLAN"|"REPORT";categoryCode:string;
  townId:string|null;reason:string;remarks:string;durationMinutes:number;status:"DRAFT"|"SUBMITTED";createdAt:string};
export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string | null };
};
export type Tenant = { id: string; name: string; slug: string; status: "active" | "inactive" };
export type AccessContext = {
  roles: Array<{ roleKey: "TENANT_ADMIN" | "MANAGER" | "MR"; scopeOrgUnitId: string | null }>;
  permissions: string[];
  orgAssignments: Array<{ orgUnitId: string; isPrimary: boolean }>;
};
export type FieldStop = {
  planStopId: string; sequence: number; type: "doctor" | "chemist" | "stockist";
  targetId: string; targetName: string; status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
};
export type Progress = {
  executionId: string; workDate: string; territoryId: string; startedAt: string;
  serverNow: string; requiredMinutes: number; elapsedMinutes: number; remainingMinutes: number;
  plannedCount: number; completedCount: number; inProgressCount: number; pendingCount: number;
  stops: FieldStop[];
};
export type StartOption = { planId: string; planDayId: string; workDate: string; territoryId: string };
export type FieldVisit = {
  id: string; executionId: string; planStopId: string; territoryId: string;
  status: "CHECKED_IN" | "CHECKED_OUT";
  verification: string; exceptionStatus: string; distanceMeters: number | null;
  geofenceRadiusMeters: number; checkinAt: string; checkoutAt: string | null;
};
export type PlanStop = { sequence: number; type: FieldStop["type"]; targetId: string; remarks: string | null };
export type PlanDay = { date: string; territoryId: string; remarks: string | null; stops: PlanStop[] };
export type Plan = { id: string; weekStart: string; status: string; submittedAt: string | null; days?: PlanDay[] };
export type OrgUnit = { id: string; parentId: string | null; type: string; code: string; name: string; status: string };
export type Master = { id: string; code: string; name: string; status: string; [key: string]: unknown };
export type ManagerCommand = {
  localDate: string; teamMembers: number; activeTours: number;
  submittedToursToday: number; shortDaysToday: number; activeJointWork: number;
  pending: { tourApprovals: number; gpsExceptions: number; weeklyTimesheets: number; leaves: number; expenses: number };
};
export type ManagerAnalytics = {
  period: { days: number; startDate: string; endDate: string };
  tours: { submitted: number; totalWorkedMinutes: number };
  coverage: { plannedStops: number; completedVisits: number; doctorCalls: number; chemistCalls: number; stockistCalls: number };
};
export type Coordinates = { latitude: number; longitude: number; accuracyMeters: number };

export class ApiFailure extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export class TerrevoWebApi {
  private session: Session | null = null;
  private tenantId: string | null = null;
  private onUpdate?: (session: Session | null) => void;
  private refreshInFlight: Promise<Session> | null = null;
  private parseSession(body: unknown): Session {
    if (!body || typeof body !== "object") throw new ApiFailure(502, "Session response was incomplete.");
    const value = body as Partial<Session>;
    if (typeof value.accessToken !== "string" || !value.accessToken ||
      typeof value.refreshToken !== "string" || !value.refreshToken ||
      typeof value.expiresIn !== "number" || !Number.isFinite(value.expiresIn) ||
      !value.user || typeof value.user.id !== "string" || !value.user.id) {
      throw new ApiFailure(502, "Session response was incomplete.");
    }
    return value as Session;
  }
  private async refreshOnce(): Promise<Session> {
    if (!this.refreshInFlight) {
      const refreshToken = this.session?.refreshToken;
      if (!refreshToken) throw new ApiFailure(401, "Session expired. Reconnect your account.");
      this.refreshInFlight = (async () => {
        const refreshed = await fetch("/api/v1/auth/refresh", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }), cache: "no-store",
        });
        if (!refreshed.ok) throw new ApiFailure(401, "Session expired. Reconnect your account.");
        const session = this.parseSession(await refreshed.json().catch(() => null));
        if (this.session?.refreshToken !== refreshToken) {
          throw new ApiFailure(401, "The account session changed during refresh.");
        }
        this.setSession(session);
        return session;
      })().finally(() => { this.refreshInFlight = null; });
    }
    return this.refreshInFlight;
  }
  constructor(onUpdate?: (session: Session | null) => void) { this.onUpdate = onUpdate; }
  get connected(): boolean { return Boolean(this.session?.accessToken && this.tenantId); }
  setSession(session: Session | null) { this.session = session; this.onUpdate?.(session); }
  setTenant(id: string | null) { this.tenantId = id; }
  reset() { this.session = null; this.tenantId = null; this.onUpdate?.(null); }

  private async raw(path: string, method = "GET", body?: unknown, tenantScoped = true, retry = true): Promise<unknown> {
    if (!this.session) throw new ApiFailure(401, "Connect an existing account to use live business records.");
    if (tenantScoped && !this.tenantId) throw new ApiFailure(400, "Select an organization first.");
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${this.session.accessToken}`,
    };
    if (tenantScoped && this.tenantId) headers["x-tenant-id"] = this.tenantId;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`/api${path}`, {
      method, headers, cache: "no-store",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401 && retry && this.session?.refreshToken) {
      // A parallel request may already have rotated the token.
      if (headers.authorization === "Bearer " + this.session.accessToken) {
        try { await this.refreshOnce(); }
        catch {
          this.reset();
          throw new ApiFailure(401, "Session expired. Reconnect your account.");
        }
      }
      // Errors from the retried business operation must not invalidate a valid session.
      return this.raw(path, method, body, tenantScoped, false);
    }
    if (!response.ok) {
      const value: unknown = await response.json().catch(() => null);
      const serverMessage = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : null;
      throw new ApiFailure(response.status, serverMessage ?? `Request failed: ${response.status}`);
    }
    if (response.status === 204 || response.status === 202) return null;
    return response.json();
  }

  async login(email: string, password: string): Promise<Session> {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }), cache: "no-store",
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ApiFailure(response.status, "Unable to connect account. Check the provided credentials.");
    const session = this.parseSession(body);
    this.setSession(session);
    return session;
  }
  async logout() {
    try { if (this.session) await this.raw("/v1/auth/logout", "POST", undefined, false, false); }
    finally { this.reset(); }
  }
  async tenants(): Promise<Tenant[]> { return (await this.raw("/v1/tenants", "GET", undefined, false) as { tenants: Tenant[] }).tenants; }
  async access(): Promise<AccessContext> { return (await this.raw("/v1/access-context") as { context: AccessContext }).context; }
  async progress(): Promise<Progress | null> { return (await this.raw("/v1/tour-executions/progress") as { progress: Progress | null }).progress; }
  async startOptions(): Promise<StartOption[]> { return (await this.raw("/v1/tour-executions/start-options") as { options: StartOption[] }).options; }
  async openVisit(): Promise<FieldVisit | null> { return (await this.raw("/v1/visits/open") as { visit: FieldVisit | null }).visit; }
  async startTour(planDayId: string, location: Coordinates) {
    return this.raw("/v1/tour-executions/start", "POST", {
      operationId: crypto.randomUUID(), planDayId, ...location, deviceStartedAt: new Date().toISOString(),
      deviceId: null, networkType: null, appVersion: "terrevo-web-0.21",
    });
  }
  async checkIn(planStopId: string, location: Coordinates, exceptionReason: string | null) {
    return this.raw("/v1/visits/check-in", "POST", { operationId: crypto.randomUUID(), planStopId, ...location, exceptionReason });
  }
  async checkOut(visitId: string, location: Coordinates) {
    return this.raw(`/v1/visits/${encodeURIComponent(visitId)}/check-out`, "POST", { operationId: crypto.randomUUID(), ...location });
  }
  async doctorCall(visitId: string, outcome: string, remarks: string | null) {
    return this.raw(`/v1/visits/${encodeURIComponent(visitId)}/doctor-call`, "PUT", { operationId: crypto.randomUUID(), callOutcome: outcome, remarks, nextAction: null, products: [] });
  }
  async tradeCall(visitId: string, outcome: string, remarks: string | null) {
    return this.raw(`/v1/visits/${encodeURIComponent(visitId)}/trade-call`, "PUT", { operationId: crypto.randomUUID(), outcome, remarks, nextAction: null });
  }
  async submitTour(shortDayReason: string | null) {
    return this.raw("/v1/tour-executions/submit", "POST", { operationId: crypto.randomUUID(), shortDayReason });
  }
  async ownUnplannedCalls():Promise<UnplannedCall[]>{
    return (await this.raw("/v1/unplanned-calls/own") as {calls:UnplannedCall[]}).calls;
  }
  async pendingUnplannedCalls():Promise<UnplannedCall[]>{
    return (await this.raw("/v1/unplanned-approvals") as {calls:UnplannedCall[]}).calls;
  }
  async submitUnplannedCall(input:{executionId:string;territoryId:string;customerType:"doctor"|"chemist"|"stockist";
    customerId:string;reason:string;remarks:string;durationMinutes:number;
    latitude:number;longitude:number;accuracyMeters:number;operationId?:string;}):Promise<UnplannedCall>{
    return (await this.raw("/v1/unplanned-calls","POST",{...input,operationId:input.operationId??crypto.randomUUID()}) as {call:UnplannedCall}).call;
  }
  async reviewUnplannedCall(id:string,decision:"APPROVE"|"REJECT",comment:string|null):Promise<UnplannedCall>{
    return (await this.raw("/v1/unplanned-approvals/"+encodeURIComponent(id)+"/decision","POST",{decision,comment}) as {call:UnplannedCall}).call;
  }
  async ncaOptions():Promise<NcaOptions>{
    return (await this.raw("/v1/nca/options") as {options:NcaOptions}).options;
  }
  async ownNcaRecords():Promise<NcaRecord[]>{
    return (await this.raw("/v1/nca/own") as {records:NcaRecord[]}).records;
  }
  async saveNcaDraft(input:{phase:"PLAN"|"REPORT";workDate:string;territoryId:string;
    categoryCode:string;townId:string|null;reason:string;remarks:string;durationMinutes:number;operationId?:string}):Promise<NcaRecord>{
    return (await this.raw("/v1/nca","POST",{...input,operationId:input.operationId??crypto.randomUUID()}) as {record:NcaRecord}).record;
  }
  async submitNca(id:string):Promise<NcaRecord>{
    return (await this.raw("/v1/nca/"+encodeURIComponent(id)+"/submit","POST") as {record:NcaRecord}).record;
  }
  async configureNcaCategory(code:string,label:string){
    return this.raw("/v1/nca/categories","POST",{code,label});
  }
  async configureNcaTown(territoryId:string,name:string){
    return this.raw("/v1/nca/towns","POST",{territoryId,name});
  }
  async plans(): Promise<Plan[]> { return (await this.raw("/v1/tour-plans") as { plans: Plan[] }).plans; }
  async getPlan(planId: string): Promise<Plan> {
    return (await this.raw("/v1/tour-plans/" + encodeURIComponent(planId)) as { plan: Plan }).plan;
  }
  async updatePlan(planId: string, weekStart: string, days: PlanDay[]): Promise<Plan> {
    return (await this.raw("/v1/tour-plans/" + encodeURIComponent(planId),"PUT",{ weekStart, days }) as { plan: Plan }).plan;
  }
  async savePlan(weekStart: string, days: PlanDay[]): Promise<Plan> {
    return (await this.raw("/v1/tour-plans", "POST", { weekStart, days }) as { plan: Plan }).plan;
  }
  async submitPlan(planId: string) { return this.raw(`/v1/tour-plans/${encodeURIComponent(planId)}/submit`, "POST"); }
  async pendingPlans(): Promise<Plan[]> { return (await this.raw("/v1/tour-approvals") as { plans: Plan[] }).plans; }
  async decidePlan(planId: string, decision: "APPROVE" | "REJECT" | "RETURN", comment: string | null) {
    return this.raw(`/v1/tour-approvals/${encodeURIComponent(planId)}/decision`, "POST", { decision, comment });
  }
  async manager(): Promise<ManagerCommand> { return (await this.raw("/v1/manager/command-center") as { commandCenter: ManagerCommand }).commandCenter; }
  async analytics(): Promise<ManagerAnalytics> { return (await this.raw("/v1/manager/analytics?days=7") as { analytics: ManagerAnalytics }).analytics; }
  async orgUnits(): Promise<OrgUnit[]> { return (await this.raw("/v1/org-units") as { units: OrgUnit[] }).units; }
  async createOrgUnit(input: { type: string; code: string; name: string; parentId: string | null }) {
    return this.raw("/v1/org-units", "POST", input);
  }
  async masters(kind: string): Promise<Master[]> { return (await this.raw(`/v1/masters/${encodeURIComponent(kind)}`) as { items: Master[] }).items; }
  async assignRole(userId: string, roleKey: "TENANT_ADMIN" | "MANAGER" | "MR", scopeOrgUnitId: string | null) {
    return this.raw("/v1/role-assignments", "POST", { userId, roleKey, scopeOrgUnitId });
  }
  async platformContext(): Promise<boolean> {
    return (await this.raw("/v1/platform/context", "GET", undefined, false) as { isSuperAdmin: boolean }).isSuperAdmin === true;
  }
  async platformTenants(offset = 0): Promise<Tenant[]> {
    return (await this.raw("/v1/platform/tenants?offset=" + offset, "GET", undefined, false) as { tenants: Tenant[] }).tenants;
  }
  async createPlatformTenant(name: string, slug: string): Promise<Tenant> {
    return (await this.raw("/v1/platform/tenants", "POST", { name, slug }, false) as { tenant: Tenant }).tenant;
  }
  async changePlatformTenantStatus(id: string, status: "active" | "inactive"): Promise<Tenant> {
    return (await this.raw("/v1/platform/tenants/" + encodeURIComponent(id) + "/status", "PATCH", { status }, false) as { tenant: Tenant }).tenant;
  }
  async platformAudit(): Promise<Array<{ id: number; action: string; tenant_id: string; occurred_at: string; actor_user_id: string }>> {
    return (await this.raw("/v1/platform/audit", "GET", undefined, false) as {events: Array<{id:number;action:string;tenant_id:string;occurred_at:string;actor_user_id:string}>}).events;
  }
  async createMaster(kind:string,input:Record<string,unknown>):Promise<Master>{
    return (await this.raw("/v1/masters/"+encodeURIComponent(kind),"POST",input) as {item:Master}).item;
  }
  async attendance():Promise<Array<{workDate:string;status:string;workedMinutes:number|null;requiredMinutes:number|null}>> {
    return (await this.raw("/v1/attendance") as {attendance:Array<{workDate:string;status:string;workedMinutes:number|null;requiredMinutes:number|null}>}).attendance;
  }
  async gpsExceptions():Promise<Array<FieldVisit & {planId:string}>> {
    return (await this.raw("/v1/visit-exceptions") as {exceptions:Array<FieldVisit & {planId:string}>}).exceptions;
  }
  async decideGpsException(visitId:string,decision:"APPROVE"|"REJECT",comment:string|null) {
    return this.raw("/v1/visit-exceptions/"+encodeURIComponent(visitId)+"/decision","POST",{decision,comment});
  }
  async dcrs(): Promise<Array<{ id: string; doctorName: string; doctorCode: string; callOutcome: string; submittedAt: string; doctorId: string }>> {
    return (await this.raw("/v1/dcrs") as {dcrs: Array<{id:string;doctorName:string;doctorCode:string;callOutcome:string;submittedAt:string;doctorId:string}>}).dcrs;
  }
  async rcpa(visitId: string): Promise<{lines: Array<{sequence:number;productId:string|null;competitorBrand:string|null;prescriptionCount:number;stockQuantity:number;salesQuantity:number}>} | null> {
    try { return (await this.raw("/v1/visits/" + encodeURIComponent(visitId) + "/rcpa") as {rcpa: {lines: Array<{sequence:number;productId:string|null;competitorBrand:string|null;prescriptionCount:number;stockQuantity:number;salesQuantity:number}>}}).rcpa; }
    catch (e) { if (e instanceof ApiFailure && e.status === 404) return null; throw e; }
  }
  async saveRcpa(visitId: string, lines: Array<{sequence:number;productId:string|null;competitorBrand:string|null;prescriptionCount:number;stockQuantity:number;salesQuantity:number}>) {
    return this.raw("/v1/visits/" + encodeURIComponent(visitId) + "/rcpa", "PUT", {operationId:crypto.randomUUID(),lines});
  }
  async order(visitId: string): Promise<{lines: Array<{productId:string;quantity:number;remarks:string|null}>} | null> {
    try { return (await this.raw("/v1/visits/" + encodeURIComponent(visitId) + "/order") as {order:{lines:Array<{productId:string;quantity:number;remarks:string|null}>}}).order; }
    catch (e) { if (e instanceof ApiFailure && e.status===404) return null; throw e; }
  }
  async saveOrder(visitId: string, lines: Array<{sequence:number;productId:string;quantity:number;remarks:string|null}>) {
    return this.raw("/v1/visits/" + encodeURIComponent(visitId) + "/order", "PUT", {operationId:crypto.randomUUID(),remarks:null,lines});
  }
  async inventory(): Promise<Array<{id:string;employeeId:string;itemType:"sample"|"gift";itemId:string;quantity:number}>> {
    return (await this.raw("/v1/inventory") as {balances:Array<{id:string;employeeId:string;itemType:"sample"|"gift";itemId:string;quantity:number}>}).balances;
  }
  async distributions(visitId: string): Promise<Array<{id:string;itemType:"sample"|"gift";itemId:string;quantity:number}>> {
    return (await this.raw("/v1/visits/" + encodeURIComponent(visitId) + "/distributions") as {distributions:Array<{id:string;itemType:"sample"|"gift";itemId:string;quantity:number}>}).distributions;
  }
  async distribute(visitId: string, items: Array<{itemType:"sample"|"gift";itemId:string;quantity:number}>) {
    return this.raw("/v1/visits/" + encodeURIComponent(visitId) + "/distributions","POST",{operationId:crypto.randomUUID(),items});
  }
  async dailyTimesheets(): Promise<Array<{id:string;workDate:string;totalMinutes:number;visitMinutes:number;status:string;callCount:number}>> {
    return (await this.raw("/v1/timesheets/daily/own") as {timesheets:Array<{id:string;workDate:string;totalMinutes:number;visitMinutes:number;status:string;callCount:number}>}).timesheets;
  }
  async weeklyTimesheets(): Promise<Array<{id:string;weekStart:string;status:string;totalMinutes:number;dailyCount:number}>> {
    return (await this.raw("/v1/timesheets/weekly/own") as {timesheets:Array<{id:string;weekStart:string;status:string;totalMinutes:number;dailyCount:number}>}).timesheets;
  }
  async generateWeeklyTimesheet(weekStart: string) {
    return this.raw("/v1/timesheets/weekly/generate","POST",{weekStart});
  }
  async submitWeeklyTimesheet(id:string, comment:string|null) {
    return this.raw("/v1/timesheets/weekly/"+encodeURIComponent(id)+"/submit","POST",{operationId:crypto.randomUUID(),comment});
  }
  async leaves():Promise<Array<{id:string;leaveType:string;startDate:string;endDate:string;reason:string;status:string}>> {
    return (await this.raw("/v1/leaves/own") as {leaves:Array<{id:string;leaveType:string;startDate:string;endDate:string;reason:string;status:string}>}).leaves;
  }
  async requestLeave(leaveType:"FULL_DAY"|"HALF_DAY",startDate:string,endDate:string,reason:string) {
    return this.raw("/v1/leaves","POST",{operationId:crypto.randomUUID(),leaveType,startDate,endDate,reason});
  }
  async expenses():Promise<Array<{id:string;workDate:string;totalAmount:number;currencyCode:string;status:string;executionId:string}>> {
    return (await this.raw("/v1/expenses/own") as {claims:Array<{id:string;workDate:string;totalAmount:number;currencyCode:string;status:string;executionId:string}>}).claims;
  }
  async saveExpense(executionId:string,currencyCode:string,amount:number,category:"TRAVEL"|"MEAL"|"LODGING"|"LOCAL_CONVEYANCE"|"OTHER",remarks:string|null) {
    return this.raw("/v1/executions/" + encodeURIComponent(executionId) + "/expense","PUT",{operationId:crypto.randomUUID(),currencyCode,lines:[{sequence:1,category,amount,remarks,receiptReference:null}]});
  }
  async submitExpense(id:string, comment:string|null) {
    return this.raw("/v1/expenses/"+encodeURIComponent(id)+"/submit","POST",{operationId:crypto.randomUUID(),comment});
  }
  async jointWork():Promise<Array<{id:string;workDate:string;status:string;targetEmployeeId:string;selfRole:string|null}>> {
    return (await this.raw("/v1/joint-work/own") as {assignments:Array<{id:string;workDate:string;status:string;targetEmployeeId:string;selfRole:string|null}>}).assignments;
  }
  async joinJointWork(id:string,location:Coordinates){
    return this.raw("/v1/joint-work/"+encodeURIComponent(id)+"/join","POST",{operationId:crypto.randomUUID(),location});
  }
  async leaveJointWork(id:string,location:Coordinates){
    return this.raw("/v1/joint-work/"+encodeURIComponent(id)+"/leave","POST",{operationId:crypto.randomUUID(),location});
  }
  async pendingLeaveApprovals():Promise<Array<{id:string;employeeId:string;leaveType:string;startDate:string;endDate:string;status:string}>> {
    return (await this.raw("/v1/leave-approvals") as {leaves:Array<{id:string;employeeId:string;leaveType:string;startDate:string;endDate:string;status:string}>}).leaves;
  }
  async decideLeave(id:string,decision:"APPROVE"|"REJECT",comment:string|null){
    return this.raw("/v1/leave-approvals/"+encodeURIComponent(id)+"/decision","POST",{operationId:crypto.randomUUID(),decision,comment});
  }
  async pendingExpenseApprovals():Promise<Array<{id:string;employeeId:string;totalAmount:number;currencyCode:string;status:string}>> {
    return (await this.raw("/v1/expense-approvals") as {claims:Array<{id:string;employeeId:string;totalAmount:number;currencyCode:string;status:string}>}).claims;
  }
  async decideExpense(id:string,decision:"APPROVE"|"REJECT"|"RETURN",comment:string|null){
    return this.raw("/v1/expense-approvals/"+encodeURIComponent(id)+"/decision","POST",{operationId:crypto.randomUUID(),decision,comment});
  }
  async pendingWeeklyTimesheets():Promise<Array<{id:string;employeeId:string;weekStart:string;status:string}>> {
    return (await this.raw("/v1/timesheet-approvals") as {timesheets:Array<{id:string;employeeId:string;weekStart:string;status:string}>}).timesheets;
  }
  async decideWeeklyTimesheet(id:string,decision:"APPROVE"|"RETURN",comment:string|null){
    return this.raw("/v1/timesheet-approvals/"+encodeURIComponent(id)+"/decision","POST",{operationId:crypto.randomUUID(),decision,comment});
  }

}

/** Geolocation is collected at user action time. Never fabricate GPS evidence. */
export async function freshPosition(): Promise<Coordinates> {
  if (!("geolocation" in navigator)) throw new Error("This device does not provide location access.");
  return new Promise<Coordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy }),
      e => reject(new Error(`Location unavailable: ${e.message}`)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}
