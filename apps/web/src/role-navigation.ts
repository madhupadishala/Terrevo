export type TerrevoRole = "TENANT_ADMIN" | "MANAGER" | "MR" | string;

const EMPLOYEE = ["overview","today","customers","activities","edetailing","field","plans","trade","inventory","workforce","reports"] as const;
const MANAGER = [...EMPLOYEE,"manager","approvals"] as const;
const ADMIN = [...MANAGER,"admin"] as const;

export function allowedWorkspaceIds(input: {
  authenticated: boolean;
  connected: boolean;
  isPlatformAdmin: boolean;
  roles: TerrevoRole[];
}): Set<string> {
  if (!input.authenticated) return new Set(["overview"]);
  if (!input.connected) return new Set(input.isPlatformAdmin ? ["overview","platform"] : ["overview"]);
  const roleSet = new Set(input.roles);
  const base = roleSet.has("TENANT_ADMIN") ? ADMIN : roleSet.has("MANAGER") ? MANAGER : EMPLOYEE;
  const ids = new Set<string>(base);
  if (input.isPlatformAdmin) ids.add("platform");
  return ids;
}
