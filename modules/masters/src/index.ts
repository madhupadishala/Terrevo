import type { OrganizationRepository, OrgUnitType } from "../../organization/src/index.ts";
import type { RbacService } from "../../rbac/src/index.ts";

export const MASTER_KINDS = [
  "employees",
  "doctors",
  "products",
  "chemists",
  "stockists",
  "samples",
  "gifts",
] as const;
export type MasterKind = typeof MASTER_KINDS[number];

export type MasterRecord = {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
  [key: string]: unknown;
};

export type MastersRepository = {
  list(kind: MasterKind, tenantId: string, accessToken: string): Promise<MasterRecord[]>;
  get(kind: MasterKind, tenantId: string, id: string, accessToken: string): Promise<MasterRecord | null>;
  create(kind: MasterKind, tenantId: string, input: Record<string, unknown>): Promise<MasterRecord>;
};

export class MasterInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value: unknown, field: string, nullable = false): string | null {
  if (nullable && (value == null || value === "")) return null;
  if (typeof value !== "string" || !UUID.test(value)) throw new MasterInputError(`${field} must be a UUID`);
  return value;
}

function text(value: unknown, field: string, max = 160, nullable = false): string | null {
  if (nullable && (value == null || value === "")) return null;
  if (typeof value !== "string") throw new MasterInputError(`${field} is required`);
  const result = value.trim();
  if (!result || result.length > max) throw new MasterInputError(`Invalid ${field}`);
  return result;
}

function code(value: unknown): string {
  const result = text(value, "code", 50)!.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(result)) throw new MasterInputError("Invalid code");
  return result;
}

function coordinate(value: unknown, field: "latitude" | "longitude"): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new MasterInputError(`Invalid ${field}`);
  const max = field === "latitude" ? 90 : 180;
  if (value < -max || value > max) throw new MasterInputError(`Invalid ${field}`);
  return value;
}

function positiveInteger(value: unknown, field: string, fallback: number): number {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 31) {
    throw new MasterInputError(`Invalid ${field}`);
  }
  return value as number;
}

async function requireActiveOrgUnit(
  organization: OrganizationRepository,
  tenantId: string,
  orgUnitId: string,
  accessToken: string,
) {
  const unit = await organization.getUnit(tenantId, orgUnitId, accessToken);
  if (!unit) throw new MasterInputError("Organization unit must be active and accessible");
  return unit;
}

async function requireScopeType(
  organization: OrganizationRepository,
  tenantId: string,
  orgUnitId: string,
  accessToken: string,
  expected: OrgUnitType,
) {
  const unit = await requireActiveOrgUnit(organization, tenantId, orgUnitId, accessToken);
  if (unit.type !== expected) throw new MasterInputError(`Scope must be an active ${expected}`);
}

export function createMastersService(
  repository: MastersRepository,
  organization: OrganizationRepository,
  rbac: RbacService,
) {
  return {
    list(kind: MasterKind, tenantId: string, accessToken: string) {
      return repository.list(kind, tenantId, accessToken);
    },

    async create(
      kind: MasterKind,
      tenantId: string,
      accessToken: string,
      value: Record<string, unknown>,
    ) {
      const common = { code: code(value.code), name: text(value.name, "name")! };
      let scopeOrgUnitId: string;
      let input: Record<string, unknown>;

      switch (kind) {
        case "employees": {
          scopeOrgUnitId = uuid(value.orgUnitId, "orgUnitId")!;
          await requireActiveOrgUnit(organization, tenantId, scopeOrgUnitId, accessToken);
          input = {
            ...common,
            designation: text(value.designation, "designation", 100)!,
            orgUnitId: scopeOrgUnitId,
            userId: uuid(value.userId, "userId", true),
            reportingManagerEmployeeId: uuid(value.reportingManagerEmployeeId, "reportingManagerEmployeeId", true),
          };
          break;
        }
        case "doctors": {
          scopeOrgUnitId = uuid(value.territoryId, "territoryId")!;
          await requireScopeType(organization, tenantId, scopeOrgUnitId, accessToken, "territory");
          input = {
            ...common,
            specialty: text(value.specialty, "specialty", 100)!,
            category: text(value.category, "category", 50, true),
            clinic: text(value.clinic, "clinic", 160, true),
            address: text(value.address, "address", 500, true),
            latitude: coordinate(value.latitude, "latitude"),
            longitude: coordinate(value.longitude, "longitude"),
            visitFrequency: positiveInteger(value.visitFrequency, "visitFrequency", 1),
            territoryId: scopeOrgUnitId,
          };
          break;
        }
        case "products": {
          scopeOrgUnitId = uuid(value.divisionId, "divisionId")!;
          await requireScopeType(organization, tenantId, scopeOrgUnitId, accessToken, "division");
          input = {
            ...common,
            genericName: text(value.genericName, "genericName", 160, true),
            divisionId: scopeOrgUnitId,
          };
          break;
        }
        case "chemists":
        case "stockists": {
          scopeOrgUnitId = uuid(value.territoryId, "territoryId")!;
          await requireScopeType(organization, tenantId, scopeOrgUnitId, accessToken, "territory");
          input = {
            ...common,
            address: text(value.address, "address", 500, true),
            latitude: coordinate(value.latitude, "latitude"),
            longitude: coordinate(value.longitude, "longitude"),
            territoryId: scopeOrgUnitId,
          };
          break;
        }
        case "samples": {
          scopeOrgUnitId = uuid(value.divisionId, "divisionId")!;
          const productId = uuid(value.productId, "productId")!;
          await requireScopeType(organization, tenantId, scopeOrgUnitId, accessToken, "division");
          const product = await repository.get("products", tenantId, productId, accessToken);
          if (!product || product.divisionId !== scopeOrgUnitId) {
            throw new MasterInputError("Sample product must belong to the same division");
          }
          input = {
            ...common,
            productId,
            divisionId: scopeOrgUnitId,
            unit: text(value.unit, "unit", 40, true),
          };
          break;
        }
        case "gifts": {
          scopeOrgUnitId = uuid(value.divisionId, "divisionId")!;
          await requireScopeType(organization, tenantId, scopeOrgUnitId, accessToken, "division");
          input = {
            ...common,
            divisionId: scopeOrgUnitId,
            category: text(value.category, "category", 80, true),
          };
          break;
        }
      }

      await rbac.authorize(tenantId, "MASTER_MANAGE", scopeOrgUnitId, accessToken);
      return repository.create(kind, tenantId, input);
    },
  };
}
