import { AuthInputError, createIdentityService, readBearerToken } from "../../../modules/identity/src/index.ts";
import { createTenantService, TenantAccessError } from "../../../modules/tenant/src/index.ts";
import { createOrganizationService, OrganizationInputError } from "../../../modules/organization/src/index.ts";
import { AuthorizationError, createRbacService, RbacInputError } from "../../../modules/rbac/src/index.ts";
import { createMastersService, MASTER_KINDS, MasterInputError, type MasterKind } from "../../../modules/masters/src/index.ts";
import { createSupabaseAdapter, ProviderError, type SupabaseConfig } from "./supabase-adapter.ts";

export type ApiEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8_192) {
    throw new ApiError(413, "Request body too large");
  }
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not object");
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

function requireConfig(env: ApiEnv): SupabaseConfig {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new ApiError(500, "Identity provider is not configured");
  }
  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function mapError(error: unknown): Response {
  if (error instanceof ApiError) return json(error.status, { error: error.message });
  if (error instanceof AuthInputError) {
    const status = error.message.includes("Authorization header") ? 401 : 400;
    return json(status, { error: error.message });
  }
  if (error instanceof TenantAccessError) {
    const status = error.message.includes("access denied") ? 403 : 400;
    return json(status, { error: error.message });
  }
  if (error instanceof AuthorizationError) return json(403, { error: "Permission denied" });
  if (error instanceof OrganizationInputError || error instanceof RbacInputError || error instanceof MasterInputError) {
    return json(400, { error: error.message });
  }
  if (error instanceof ProviderError) {
    if (error.status === 401 || error.status === 403) return json(401, { error: "Authentication failed" });
    if (error.status === 409) return json(409, { error: "Conflict" });
    return json(502, { error: "Provider request failed" });
  }
  return json(500, { error: "Internal server error" });
}

export function createHandler(env: ApiEnv, deps: Deps = {}) {
  const adapter = createSupabaseAdapter(requireConfig(env), deps.fetcher);
  const identity = createIdentityService(adapter.auth);
  const tenants = createTenantService(adapter.tenants);
  const rbac = createRbacService(adapter.rbac);
  const organization = createOrganizationService(adapter.organization, rbac);
  const masters = createMastersService(adapter.masters, adapter.organization, rbac);

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
