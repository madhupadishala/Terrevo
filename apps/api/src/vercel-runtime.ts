import { createHandler, type ApiEnv } from "./handler.ts";

export type VercelRuntimeHealth = {
  status: "ok" | "degraded";
  web: "ready";
  apiAdapter: "ready";
  provider: {
    identity: "configured" | "missing";
    serverMutations: "configured" | "missing";
  };
};

function health(env: ApiEnv): VercelRuntimeHealth {
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const identityConfigured = Boolean(env.SUPABASE_URL && publishableKey);
  const serverConfigured = identityConfigured && Boolean(secretKey);
  return {
    status: serverConfigured ? "ok" : "degraded",
    web: "ready",
    apiAdapter: "ready",
    provider: {
      identity: identityConfigured ? "configured" : "missing",
      serverMutations: serverConfigured ? "configured" : "missing",
    },
  };
}

function internalPath(url: URL): string {
  const routedPath = url.searchParams.get("__terrevo_path");
  if (routedPath !== null) {
    const normalized = routedPath.replace(/^\/+/, "");
    return normalized ? `/${normalized}` : "/";
  }
  return url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}

function internalRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = internalPath(url);
  url.searchParams.delete("__terrevo_path");
  return new Request(url, request);
}

export function createVercelApiHandler(env: ApiEnv) {
  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = internalPath(url);

      if (request.method === "GET" && path === "/health") {
        return Response.json(health(env), {
          headers: { "cache-control": "no-store" },
        });
      }

      if (!env.SUPABASE_URL || !(env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY)) {
        return Response.json(
          { error: "API provider configuration is missing" },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }

      return createHandler(env)(internalRequest(request));
    },
  };
}
