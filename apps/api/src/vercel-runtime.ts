import { createHandler, type ApiEnv } from "./handler.ts";
import { hardenApiResponse, resolveRequestId } from "../../../modules/security/src/index.ts";

export type VercelRuntimeHealth = {
  status: "ok" | "degraded";
  web: "ready";
  apiAdapter: "ready";
  provider: {
    identity: "configured" | "missing";
    serverMutations: "configured" | "missing";
  };
};

export type ApiRequestLog = {
  event: "api_request";
  requestId: string;
  method: string;
  route: string;
  status: number;
  elapsedMs: number;
};

// Omit query strings, arbitrary paths, record identifiers and all payloads.
function logRoute(path: string): string {
  if (path === "/health") return path;
  const group = /^\/v1\/(auth|me|tenants|qualification|access-context|organization|masters|platform|manager|tour-plans|tour-approvals|tour-executions|visits|field-settings|visit-exceptions|dcrs|inventory|joint-work|expenses|expense-approvals|executions|unplanned-calls|unplanned-approvals|nca|leaves|leave-approvals|attendance|timesheets|timesheet-approvals|business)(?:\/|$)/.exec(path);
  return group ? `/v1/${group[1]}` : "unknown";
}

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

export function createVercelApiHandler(env: ApiEnv, log: (entry: ApiRequestLog) => void = (entry) => console.info(JSON.stringify(entry))) {
  return {
    async fetch(request: Request): Promise<Response> {
      const requestId = resolveRequestId(request.headers.get("x-request-id"));
      const url = new URL(request.url);
      const path = internalPath(url);
      const started = performance.now();
      const finish = (response: Response) => {
        const hardened = hardenApiResponse(response, requestId);
        try { log({event:"api_request",requestId,method:request.method,route:logRoute(path),status:response.status,elapsedMs:Math.round(performance.now()-started)}); }
        catch { /* Logging failure must not replay or fail a committed mutation. */ }
        return hardened;
      };

      if (request.method === "GET" && path === "/health") {
        return finish(Response.json(health(env), {
          headers: { "cache-control": "no-store" },
        }));
      }

      if (!env.SUPABASE_URL || !(env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY)) {
        return finish(Response.json(
          { error: "API provider configuration is missing" },
          { status: 503, headers: { "cache-control": "no-store" } },
        ));
      }

      return finish(await createHandler(env)(internalRequest(request)));
    },
  };
}
