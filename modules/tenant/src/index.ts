export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
};

export type TenantRepository = {
  listAccessible(accessToken: string): Promise<TenantSummary[]>;
  hasActiveAccess(tenantId: string, accessToken: string): Promise<boolean>;
};

export class TenantAccessError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireTenantId(value: string | null): string {
  const tenantId = value?.trim();
  if (!tenantId) throw new TenantAccessError("Missing X-Tenant-Id header");
  if (!UUID.test(tenantId)) throw new TenantAccessError("Invalid tenant ID");
  return tenantId;
}

export function createTenantService(repository: TenantRepository) {
  return {
    listAccessible(accessToken: string) {
      return repository.listAccessible(accessToken);
    },

    async resolveContext(userId: string, tenantHeader: string | null, accessToken: string) {
      const tenantId = requireTenantId(tenantHeader);
      if (!(await repository.hasActiveAccess(tenantId, accessToken))) {
        throw new TenantAccessError("Tenant access denied");
      }
      return { userId, tenantId };
    },
  };
}
