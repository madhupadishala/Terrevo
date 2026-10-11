import type { SupabaseConfig } from "./supabase-adapter.ts";
import { ProviderError } from "./supabase-adapter.ts";

export type PlatformTenant = {
  id: string; name: string; slug: string; status: "active" | "inactive";
};
export type PlatformAuditEvent = {
  id: number; actor_user_id: string; action: string; tenant_id: string;
  details: Record<string, unknown>; occurred_at: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PlatformForbiddenError extends Error {}
export class PlatformValidationError extends Error {}
export class PlatformNotFoundError extends Error {}

/** Separate control plane; no tenant RBAC or client-supplied platform authority. */
export function createPlatformAdminService(config: SupabaseConfig, fetcher: typeof fetch = fetch) {
  const root = config.url.replace(/\/+$/, "");
  function headers(prefer?: string): HeadersInit {
    if (!config.serviceRoleKey) throw new ProviderError("Server provider key is not configured", 500);
    return {
      apikey: config.serviceRoleKey,
      authorization: "Bearer " + config.serviceRoleKey,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    };
  }
  async function request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const response = await fetcher(root + "/rest/v1/" + path, {
      method,
      headers: headers(method === "POST" ? "return=representation" : undefined),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      if (response.status === 403) throw new PlatformForbiddenError("Platform permission denied");
      if (response.status === 400) throw new PlatformValidationError("Invalid platform request");
      if (response.status === 409) throw new PlatformValidationError("Conflict: duplicate or invalid platform record");
      if (response.status === 404) throw new PlatformNotFoundError("Requested platform record not found");
      throw new ProviderError("Platform provider operation failed", response.status);
    }
    return response.status === 204 ? null : response.json();
  }
  async function isPlatformAdmin(userId: string): Promise<boolean> {
    if (!UUID.test(userId)) return false;
    const search = new URLSearchParams({ select: "user_id", user_id: "eq." + userId, active: "eq.true", limit: "1" });
    const rows = await request("platform_admin_grants?" + search) as Array<{ user_id: string }>;
    return Array.isArray(rows) && rows.some(x => x.user_id === userId);
  }
  async function requirePlatformAdmin(userId: string): Promise<void> {
    if (!(await isPlatformAdmin(userId))) throw new PlatformForbiddenError("Platform permission denied");
  }
  return {
    isPlatformAdmin,
    async listTenants(userId: string, offset = 0) {
      await requirePlatformAdmin(userId);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new PlatformValidationError("Invalid pagination offset");
      const query = new URLSearchParams({ select: "id,name,slug,status", order: "name.asc", limit: "100", offset: String(offset) });
      return await request("tenants?" + query) as PlatformTenant[];
    },
    async createTenant(userId: string, value: Record<string, unknown>) {
      await requirePlatformAdmin(userId);
      const name = typeof value.name === "string" ? value.name.trim() : "";
      const slug = typeof value.slug === "string" ? value.slug.trim().toLowerCase() : "";
      if (name.length < 2 || name.length > 160 || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug))
        throw new PlatformValidationError("Provide a valid organization name and lowercase slug");
      return await request("rpc/platform_create_tenant", "POST", { p_actor_user_id: userId, p_name: name, p_slug: slug }) as PlatformTenant;
    },
    async setTenantStatus(userId: string, tenantId: string, value: Record<string, unknown>) {
      await requirePlatformAdmin(userId);
      if (!UUID.test(tenantId)) throw new PlatformValidationError("Invalid tenant ID");
      if (value.status !== "active" && value.status !== "inactive") throw new PlatformValidationError("Invalid status");
      return await request("rpc/platform_set_tenant_status", "POST", {
        p_actor_user_id: userId, p_tenant_id: tenantId, p_status: value.status,
      }) as PlatformTenant;
    },
    async audit(userId: string, offset = 0) {
      await requirePlatformAdmin(userId);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new PlatformValidationError("Invalid pagination offset");
      const query = new URLSearchParams({
        select: "id,actor_user_id,action,tenant_id,details,occurred_at",
        order: "occurred_at.desc,id.desc", limit: "50", offset: String(offset),
      });
      return await request("platform_admin_audit?" + query) as PlatformAuditEvent[];
    },
  };
}
