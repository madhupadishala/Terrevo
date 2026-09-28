import { AuthInputError, createIdentityService, readBearerToken } from "../../../modules/identity/src/index.ts";
import { createTenantService, TenantAccessError } from "../../../modules/tenant/src/index.ts";
import { createSupabaseAdapter, ProviderError, type SupabaseConfig } from "./supabase-adapter.ts";

export type ApiEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
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
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

function requireConfig(env: ApiEnv): SupabaseConfig {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new ApiError(500, "Identity provider is not configured");
  }
  return { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY };
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
  if (error instanceof ProviderError) {
    const status = error.status === 401 || error.status === 403 ? 401 : 502;
    return json(status, { error: status === 401 ? "Authentication failed" : "Identity provider unavailable" });
  }
  return json(500, { error: "Internal server error" });
}

export function createHandler(env: ApiEnv, deps: Deps = {}) {
  const adapter = createSupabaseAdapter(requireConfig(env), deps.fetcher);
  const identity = createIdentityService(adapter.auth);
  const tenants = createTenantService(adapter.tenants);

  return async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "GET" && path === "/health") {
        return json(200, { status: "ok" });
      }

      if (request.method === "POST" && path === "/v1/auth/login") {
        const body = await readJsonObject(request);
        const session = await identity.signIn(body.email, body.password);
        return json(200, session);
      }

      if (request.method === "POST" && path === "/v1/auth/refresh") {
        const body = await readJsonObject(request);
        const session = await identity.refreshSession(body.refreshToken);
        return json(200, session);
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
        const user = await identity.authenticate(request.headers.get("authorization"));
        return json(200, { user });
      }

      if (request.method === "GET" && path === "/v1/tenants") {
        const accessToken = readBearerToken(request.headers.get("authorization"));
        await identity.authenticate(request.headers.get("authorization"));
        const memberships = await tenants.listAccessible(accessToken);
        return json(200, { tenants: memberships });
      }

      if (request.method === "GET" && path === "/v1/tenant-context") {
        const accessToken = readBearerToken(request.headers.get("authorization"));
        const user = await identity.authenticate(request.headers.get("authorization"));
        const context = await tenants.resolveContext(
          user.id,
          request.headers.get("x-tenant-id"),
          accessToken,
        );
        return json(200, { context });
      }

      return json(404, { error: "Not found" });
    } catch (error) {
      return mapError(error);
    }
  };
}
