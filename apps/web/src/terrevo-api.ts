/**
 * Terrevo web transport: ALL business calls use the existing authenticated, tenant-scoped API.
 * No service-role key, synthetic business data or bypass is exposed to the browser.
 */
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
  constructor(readonly status: number, message: string) { super(message); }
}

export class TerrevoWebApi {
  private session: Session | null = null;
  private tenantId: string | null = null;
  private onUpdate?: (session: Session | null) => void;
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
    if (response.status === 401 && retry && this.session.refreshToken) {
      const refreshed = await fetch("/api/v1/auth/refresh", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: this.session.refreshToken }),
        cache: "no-store",
      });
      if (refreshed.ok) {
        this.setSession(await refreshed.json() as Session);
        return this.raw(path, method, body, tenantScoped, false);
      }
      this.reset();
      throw new ApiFailure(401, "Session expired. Reconnect your account.");
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
    if (!body || typeof body !== "object" || !("accessToken" in body) || typeof body.accessToken !== "string") {
      throw new ApiFailure(502, "Session response was incomplete.");
    }
    const session = body as Session;
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
  async plans(): Promise<Plan[]> { return (await this.raw("/v1/tour-plans") as { plans: Plan[] }).plans; }
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
