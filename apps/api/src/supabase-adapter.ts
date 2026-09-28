import type { AuthProvider, AuthSession, AuthUser } from "../../../modules/identity/src/index.ts";
import type { TenantRepository, TenantSummary } from "../../../modules/tenant/src/index.ts";

type Fetcher = typeof fetch;

export type SupabaseConfig = {
  url: string;
  anonKey: string;
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

export function createSupabaseAdapter(
  config: SupabaseConfig,
  fetcher: Fetcher = fetch,
): { auth: AuthProvider; tenants: TenantRepository } {
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

  return { auth, tenants };
}
