export const ROLE_KEYS = ["TENANT_ADMIN", "MANAGER", "MR"] as const;
export type RoleKey = typeof ROLE_KEYS[number];

export const PERMISSION_KEYS = [
  "ORG_VIEW",
  "ORG_MANAGE",
  "RBAC_VIEW",
  "RBAC_MANAGE",
  "MASTER_VIEW",
  "MASTER_MANAGE",
  "TOUR_PLAN_OWN",
  "TOUR_VIEW_TEAM",
  "TOUR_APPROVE",
] as const;
export type PermissionKey = typeof PERMISSION_KEYS[number];

export type RoleAssignment = {
  roleKey: RoleKey;
  scopeOrgUnitId: string | null;
};

export type OrgAssignmentSummary = {
  orgUnitId: string;
  isPrimary: boolean;
};

export type RbacRepository = {
  hasPermission(
    tenantId: string,
    permission: PermissionKey,
    targetOrgUnitId: string | null,
    accessToken: string,
  ): Promise<boolean>;
  listOwnRoleAssignments(tenantId: string, userId: string, accessToken: string): Promise<RoleAssignment[]>;
  listPermissions(roleKeys: RoleKey[], accessToken: string): Promise<PermissionKey[]>;
  listOwnOrgAssignments(tenantId: string, userId: string, accessToken: string): Promise<OrgAssignmentSummary[]>;
  assignRole(
    tenantId: string,
    input: { userId: string; roleKey: RoleKey; scopeOrgUnitId: string | null },
  ): Promise<void>;
};

export class AuthorizationError extends Error {}
export class RbacInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new RbacInputError(`${field} must be a UUID`);
  return value;
}

function requireRole(value: unknown): RoleKey {
  if (typeof value !== "string" || !ROLE_KEYS.includes(value as RoleKey)) {
    throw new RbacInputError("Invalid role");
  }
  return value as RoleKey;
}

export type RbacService = ReturnType<typeof createRbacService>;

export function createRbacService(repository: RbacRepository) {
  const authorize = async (
    tenantId: string,
    permission: PermissionKey,
    targetOrgUnitId: string | null,
    accessToken: string,
  ) => {
    if (!(await repository.hasPermission(tenantId, permission, targetOrgUnitId, accessToken))) {
      throw new AuthorizationError("Permission denied");
    }
  };

  return {
    authorize,

    async accessContext(tenantId: string, userId: string, accessToken: string) {
      const [roles, orgAssignments] = await Promise.all([
        repository.listOwnRoleAssignments(tenantId, userId, accessToken),
        repository.listOwnOrgAssignments(tenantId, userId, accessToken),
      ]);
      const permissions = await repository.listPermissions(
        [...new Set(roles.map((assignment) => assignment.roleKey))],
        accessToken,
      );
      return { roles, permissions: [...new Set(permissions)], orgAssignments };
    },

    async assignRole(tenantId: string, accessToken: string, value: Record<string, unknown>) {
      const userId = requireUuid(value.userId, "userId");
      const roleKey = requireRole(value.roleKey);
      const scopeOrgUnitId = value.scopeOrgUnitId == null
        ? null
        : requireUuid(value.scopeOrgUnitId, "scopeOrgUnitId");

      if (roleKey === "TENANT_ADMIN" && scopeOrgUnitId !== null) {
        throw new RbacInputError("TENANT_ADMIN must be tenant-wide");
      }
      if (roleKey !== "TENANT_ADMIN" && scopeOrgUnitId === null) {
        throw new RbacInputError(`${roleKey} requires an organization scope`);
      }

      await authorize(tenantId, "RBAC_MANAGE", scopeOrgUnitId, accessToken);
      await repository.assignRole(tenantId, { userId, roleKey, scopeOrgUnitId });
    },
  };
}
