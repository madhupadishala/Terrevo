import type { AuthProvider, AuthSession, AuthUser } from "../../../modules/identity/src/index.ts";
import type { TenantRepository, TenantSummary } from "../../../modules/tenant/src/index.ts";
import type { OrgUnit, OrganizationRepository } from "../../../modules/organization/src/index.ts";
import type { MasterKind, MasterRecord, MastersRepository } from "../../../modules/masters/src/index.ts";
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

  return { auth, tenants, organization, rbac, masters };
}
