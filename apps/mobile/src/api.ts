import type { AuthSession, DailyTimesheet, DistributionLine, DoctorCall, DoctorCallProductInput, FieldMasterKind, InventoryBalance, MasterItem, StartTourOption, SubmitTourResult, Tenant, TourProgress, Visit, VisitDistribution, WeeklyTimesheet } from "./types";
import type { DepartureIntegrity, PresencePoint } from "./presence";

const API_BASE_URL = (process.env.EXPO_PUBLIC_TERREVO_API_URL ?? "https://terrevo.vercel.app").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type SessionListener = (session: AuthSession | null) => Promise<void> | void;

export class TerrevoApi {
  private session: AuthSession | null = null;
  private tenantId: string | null = null;

  constructor(private readonly onSession: SessionListener) {}

  configure(session: AuthSession | null, tenantId: string | null) {
    this.session = session;
    this.tenantId = tenantId;
  }

  setTenant(tenantId: string | null) {
    this.tenantId = tenantId;
  }

  private async parseError(response: Response): Promise<ApiError> {
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim()) return new ApiError(response.status, body.error);
    } catch {
      // Fall through to a provider-safe generic message.
    }
    return new ApiError(response.status, `Request failed (${response.status})`);
  }

  private async request(path: string, init: RequestInit = {}, tenantScoped = true, retry = true): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (this.session?.accessToken) headers.set("authorization", `Bearer ${this.session.accessToken}`);
    if (tenantScoped) {
      if (!this.tenantId) throw new ApiError(400, "Select a company before continuing.");
      headers.set("x-tenant-id", this.tenantId);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (response.status === 401 && retry && this.session?.refreshToken) {
      const refreshed = await this.refreshSession();
      if (refreshed) return this.request(path, init, tenantScoped, false);
    }
    if (!response.ok) throw await this.parseError(response);
    return response;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw await this.parseError(response);
    const session = await response.json() as AuthSession;
    this.session = session;
    await this.onSession(session);
    return session;
  }

  private async refreshSession(): Promise<boolean> {
    if (!this.session?.refreshToken) return false;
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken: this.session.refreshToken }),
    });
    if (!response.ok) {
      this.session = null;
      await this.onSession(null);
      return false;
    }
    this.session = await response.json() as AuthSession;
    await this.onSession(this.session);
    return true;
  }

  async logout(): Promise<void> {
    try {
      if (this.session?.accessToken) await this.request("/v1/auth/logout", { method: "POST" }, false, false);
    } finally {
      this.session = null;
      this.tenantId = null;
      await this.onSession(null);
    }
  }

  async tenants(): Promise<Tenant[]> {
    const response = await this.request("/v1/tenants", {}, false);
    const body = await response.json() as { tenants: Tenant[] };
    return body.tenants;
  }

  async progress(): Promise<TourProgress | null> {
    const response = await this.request("/v1/tour-executions/progress");
    const body = await response.json() as { progress: TourProgress | null };
    return body.progress;
  }

  async startOptions(): Promise<StartTourOption[]> {
    const response = await this.request("/v1/tour-executions/start-options");
    const body = await response.json() as { options: StartTourOption[] };
    return body.options;
  }

  async startTour(input: {
    operationId: string;
    planDayId: string;
    location: PresencePoint;
    deviceId: string;
    appVersion: string;
  }): Promise<void> {
    await this.request("/v1/tour-executions/start", {
      method: "POST",
      body: JSON.stringify({
        operationId: input.operationId,
        planDayId: input.planDayId,
        deviceStartedAt: new Date().toISOString(),
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        accuracyMeters: input.location.accuracyMeters,
        deviceId: input.deviceId,
        networkType: null,
        appVersion: input.appVersion,
      }),
    });
  }

  async openVisit(): Promise<Visit | null> {
    const response = await this.request("/v1/visits/open");
    const body = await response.json() as { visit: Visit | null };
    return body.visit;
  }

  async checkIn(input: {
    operationId: string;
    planStopId: string;
    location: PresencePoint;
    exceptionReason: string | null;
  }): Promise<Visit> {
    const response = await this.request("/v1/visits/check-in", {
      method: "POST",
      body: JSON.stringify({
        operationId: input.operationId,
        planStopId: input.planStopId,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        accuracyMeters: input.location.accuracyMeters,
        exceptionReason: input.exceptionReason,
      }),
    });
    const body = await response.json() as { visit: Visit };
    return body.visit;
  }

  async master(kind: FieldMasterKind): Promise<MasterItem[]> {
    const response = await this.request(`/v1/masters/${kind}`);
    const body = await response.json() as { items: MasterItem[] };
    return body.items;
  }

  async inventory(): Promise<InventoryBalance[]> {
    const response = await this.request("/v1/inventory");
    const body = await response.json() as { balances: InventoryBalance[] };
    return body.balances;
  }

  async doctorCall(visitId: string): Promise<DoctorCall | null> {
    try {
      const response = await this.request(`/v1/visits/${encodeURIComponent(visitId)}/doctor-call`);
      const body = await response.json() as { doctorCall: DoctorCall };
      return body.doctorCall;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) return null;
      throw cause;
    }
  }

  async saveDoctorCall(visitId: string, input: {
    operationId: string;
    callOutcome: string;
    remarks: string | null;
    nextAction: string | null;
    products: DoctorCallProductInput[];
  }): Promise<DoctorCall> {
    const response = await this.request(`/v1/visits/${encodeURIComponent(visitId)}/doctor-call`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    const body = await response.json() as { doctorCall: DoctorCall };
    return body.doctorCall;
  }

  async visitDistributions(visitId: string): Promise<VisitDistribution[]> {
    const response = await this.request(`/v1/visits/${encodeURIComponent(visitId)}/distributions`);
    const body = await response.json() as { distributions: VisitDistribution[] };
    return body.distributions;
  }

  async distribute(visitId: string, input: {
    operationId: string;
    items: DistributionLine[];
  }): Promise<VisitDistribution[]> {
    const response = await this.request(`/v1/visits/${encodeURIComponent(visitId)}/distributions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const body = await response.json() as { distributions: VisitDistribution[] };
    return body.distributions;
  }

  async submitTour(input: { operationId: string; shortDayReason: string | null }): Promise<SubmitTourResult> {
    const response = await this.request("/v1/tour-executions/submit", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const body = await response.json() as { execution: SubmitTourResult };
    return body.execution;
  }

  async dailyTimesheets(): Promise<DailyTimesheet[]> {
    const response = await this.request("/v1/timesheets/daily/own");
    const body = await response.json() as { timesheets: DailyTimesheet[] };
    return body.timesheets;
  }

  async reviewDailyTimesheet(timesheetId: string, input: { operationId: string; remarks: string | null }): Promise<DailyTimesheet> {
    const response = await this.request(`/v1/timesheets/daily/${encodeURIComponent(timesheetId)}/review`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const body = await response.json() as { timesheet: DailyTimesheet };
    return body.timesheet;
  }

  async weeklyTimesheets(): Promise<WeeklyTimesheet[]> {
    const response = await this.request("/v1/timesheets/weekly/own");
    const body = await response.json() as { timesheets: WeeklyTimesheet[] };
    return body.timesheets;
  }

  async generateWeeklyTimesheet(weekStart: string): Promise<WeeklyTimesheet> {
    const response = await this.request("/v1/timesheets/weekly/generate", {
      method: "POST",
      body: JSON.stringify({ weekStart }),
    });
    const body = await response.json() as { timesheet: WeeklyTimesheet };
    return body.timesheet;
  }

  async submitWeeklyTimesheet(timesheetId: string, input: { operationId: string; comment: string | null }): Promise<WeeklyTimesheet> {
    const response = await this.request(`/v1/timesheets/weekly/${encodeURIComponent(timesheetId)}/submit`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const body = await response.json() as { timesheet: WeeklyTimesheet };
    return body.timesheet;
  }

  async recordPresence(visitId: string, input: { operationId: string; samples: PresencePoint[] }): Promise<DepartureIntegrity> {
    const response = await this.request(`/v1/visits/${encodeURIComponent(visitId)}/presence`, {
      method: "POST",
      body: JSON.stringify({ operationId: input.operationId, samples: input.samples }),
    });
    const body = await response.json() as { presence: DepartureIntegrity };
    return body.presence;
  }

  async checkOut(visitId: string, input: { operationId: string; location: PresencePoint }): Promise<Visit> {
    const response = await this.request(`/v1/visits/${encodeURIComponent(visitId)}/check-out`, {
      method: "POST",
      body: JSON.stringify({
        operationId: input.operationId,
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        accuracyMeters: input.location.accuracyMeters,
      }),
    });
    const body = await response.json() as { visit: Visit };
    return body.visit;
  }
}
