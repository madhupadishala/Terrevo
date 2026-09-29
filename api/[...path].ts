import { createHandler, type ApiEnv } from "../apps/api/src/handler.ts";

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
  const identityConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
  const serverConfigured = identityConfigured && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
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

function internalRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new Request(url, request);
}

export function createVercelApiHandler(env: ApiEnv) {
  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

      if (request.method === "GET" && path === "/health") {
        return Response.json(health(env), {
          headers: { "cache-control": "no-store" },
        });
      }

      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
        return Response.json(
          { error: "API provider configuration is missing" },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }

      return createHandler(env)(internalRequest(request));
    },
  };
}

export default createVercelApiHandler({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
