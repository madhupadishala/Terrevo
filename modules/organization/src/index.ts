import type { RbacService } from "../../rbac/src/index.ts";

export const ORG_UNIT_TYPES = ["company", "division", "zone", "region", "area", "territory"] as const;
export type OrgUnitType = typeof ORG_UNIT_TYPES[number];

export type OrgUnit = {
  id: string;
  tenantId: string;
  parentId: string | null;
  type: OrgUnitType;
  code: string;
  name: string;
  status: "active" | "inactive";
};

export type OrganizationRepository = {
  listUnits(tenantId: string, accessToken: string): Promise<OrgUnit[]>;
  getUnit(tenantId: string, orgUnitId: string, accessToken: string): Promise<OrgUnit | null>;
  createUnit(
    tenantId: string,
    input: { parentId: string | null; type: OrgUnitType; code: string; name: string },
  ): Promise<OrgUnit>;
  assignUser(
    tenantId: string,
    input: { userId: string; orgUnitId: string; isPrimary: boolean },
  ): Promise<void>;
};

export class OrganizationInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new OrganizationInputError(`${field} must be a UUID`);
  }
  return value;
}

function requireText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new OrganizationInputError(`${field} is required`);
  const text = value.trim();
  if (!text || text.length > max) throw new OrganizationInputError(`Invalid ${field}`);
  return text;
}

function requireCode(value: unknown): string {
  const code = requireText(value, "code", 40).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) throw new OrganizationInputError("Invalid code");
  return code;
}

function requireType(value: unknown): OrgUnitType {
  if (typeof value !== "string" || !ORG_UNIT_TYPES.includes(value as OrgUnitType)) {
    throw new OrganizationInputError("Invalid organization unit type");
  }
  return value as OrgUnitType;
}

const EXPECTED_PARENT: Record<Exclude<OrgUnitType, "company">, OrgUnitType> = {
  division: "company",
  zone: "division",
  region: "zone",
  area: "region",
  territory: "area",
};

export function createOrganizationService(repository: OrganizationRepository, rbac: RbacService) {
  return {
    listUnits(tenantId: string, accessToken: string) {
      return repository.listUnits(tenantId, accessToken);
    },

    async createUnit(tenantId: string, accessToken: string, value: Record<string, unknown>) {
      const type = requireType(value.type);
      const code = requireCode(value.code);
      const name = requireText(value.name, "name", 160);
      const parentId = value.parentId == null ? null : requireUuid(value.parentId, "parentId");

      if (type === "company") {
        if (parentId !== null) throw new OrganizationInputError("Company cannot have a parent");
        await rbac.authorize(tenantId, "ORG_MANAGE", null, accessToken);
      } else {
        if (!parentId) throw new OrganizationInputError(`${type} requires a parent`);
        await rbac.authorize(tenantId, "ORG_MANAGE", parentId, accessToken);
        const parent = await repository.getUnit(tenantId, parentId, accessToken);
        if (!parent) throw new OrganizationInputError("Parent organization unit not found");
        if (parent.type !== EXPECTED_PARENT[type]) {
          throw new OrganizationInputError(`${type} must be under ${EXPECTED_PARENT[type]}`);
        }
      }

      return repository.createUnit(tenantId, { parentId, type, code, name });
    },

    async assignUser(tenantId: string, accessToken: string, value: Record<string, unknown>) {
      const userId = requireUuid(value.userId, "userId");
      const orgUnitId = requireUuid(value.orgUnitId, "orgUnitId");
      const isPrimary = value.isPrimary == null ? true : value.isPrimary === true;

      await rbac.authorize(tenantId, "ORG_MANAGE", orgUnitId, accessToken);
      await repository.assignUser(tenantId, { userId, orgUnitId, isPrimary });
    },
  };
}
