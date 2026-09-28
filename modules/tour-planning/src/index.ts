import type { RbacService } from "../../rbac/src/index.ts";

export const STOP_TYPES = ["doctor", "chemist", "stockist"] as const;
export type StopType = typeof STOP_TYPES[number];

export type TourPlanStop = {
  sequence: number;
  type: StopType;
  targetId: string;
  remarks: string | null;
};

export type TourPlanDay = {
  date: string;
  territoryId: string;
  remarks: string | null;
  stops: TourPlanStop[];
};

export type TourPlan = {
  id: string;
  weekStart: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "RETURNED";
  submittedAt: string | null;
  days: TourPlanDay[];
};

export type TourPlanSummary = Omit<TourPlan, "days">;

export type TourPlanningRepository = {
  listOwn(tenantId: string, userId: string, accessToken: string): Promise<TourPlanSummary[]>;
  getOwn(tenantId: string, userId: string, planId: string, accessToken: string): Promise<TourPlan | null>;
  save(
    tenantId: string,
    userId: string,
    planId: string | null,
    weekStart: string,
    days: TourPlanDay[],
  ): Promise<string>;
  submit(tenantId: string, userId: string, planId: string): Promise<void>;
};

export class TourPlanInputError extends Error {}
export class TourPlanConflictError extends Error {}
export class TourPlanNotFoundError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new TourPlanInputError(`${field} must be a UUID`);
  return value;
}

function shortText(value: unknown, field: string, max: number, nullable = true): string | null {
  if (value == null || value === "") {
    if (nullable) return null;
    throw new TourPlanInputError(`${field} is required`);
  }
  if (typeof value !== "string") throw new TourPlanInputError(`Invalid ${field}`);
  const result = value.trim();
  if (!result || result.length > max) throw new TourPlanInputError(`Invalid ${field}`);
  return result;
}

function date(value: unknown, field: string): string {
  if (typeof value !== "string" || !DATE.test(value)) throw new TourPlanInputError(`Invalid ${field}`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TourPlanInputError(`Invalid ${field}`);
  }
  return value;
}

function parseWeekStart(value: unknown): string {
  const result = date(value, "weekStart");
  if (new Date(`${result}T00:00:00Z`).getUTCDay() !== 1) {
    throw new TourPlanInputError("weekStart must be a Monday");
  }
  return result;
}

function normalizeDays(value: unknown, weekStart: string): TourPlanDay[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) {
    throw new TourPlanInputError("days must contain 1 to 7 entries");
  }

  const week = new Date(`${weekStart}T00:00:00Z`);
  const seenDates = new Set<string>();

  return value.map((raw, dayIndex) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new TourPlanInputError(`Invalid day at index ${dayIndex}`);
    }
    const input = raw as Record<string, unknown>;
    const dayDate = date(input.date, "day date");
    if (seenDates.has(dayDate)) throw new TourPlanInputError("Duplicate plan date");
    seenDates.add(dayDate);

    const difference = (
      new Date(`${dayDate}T00:00:00Z`).getTime() - week.getTime()
    ) / 86_400_000;
    if (!Number.isInteger(difference) || difference < 0 || difference > 6) {
      throw new TourPlanInputError("Plan day must be inside the selected week");
    }

    const territoryId = uuid(input.territoryId, "territoryId");
    if (!Array.isArray(input.stops) || input.stops.length > 50) {
      throw new TourPlanInputError("stops must be an array with at most 50 entries");
    }

    const sequences = new Set<number>();
    const targets = new Set<string>();
    const stops = input.stops.map((rawStop, stopIndex) => {
      if (!rawStop || typeof rawStop !== "object" || Array.isArray(rawStop)) {
        throw new TourPlanInputError(`Invalid stop at index ${stopIndex}`);
      }
      const stop = rawStop as Record<string, unknown>;
      if (!Number.isInteger(stop.sequence) || (stop.sequence as number) < 1) {
        throw new TourPlanInputError("Stop sequence must be a positive integer");
      }
      const sequence = stop.sequence as number;
      if (sequences.has(sequence)) throw new TourPlanInputError("Duplicate stop sequence");
      sequences.add(sequence);

      if (typeof stop.type !== "string" || !STOP_TYPES.includes(stop.type as StopType)) {
        throw new TourPlanInputError("Invalid stop type");
      }
      const type = stop.type as StopType;
      const targetId = uuid(stop.targetId, "targetId");
      const targetKey = `${type}:${targetId}`;
      if (targets.has(targetKey)) throw new TourPlanInputError("Duplicate stop target in one day");
      targets.add(targetKey);

      return {
        sequence,
        type,
        targetId,
        remarks: shortText(stop.remarks, "stop remarks", 500),
      };
    }).sort((a, b) => a.sequence - b.sequence);

    return {
      date: dayDate,
      territoryId,
      remarks: shortText(input.remarks, "day remarks", 1000),
      stops,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function createTourPlanningService(repository: TourPlanningRepository, rbac: RbacService) {
  const authorizeTerritories = async (
    tenantId: string,
    accessToken: string,
    days: TourPlanDay[],
  ) => {
    const territories = [...new Set(days.map((day) => day.territoryId))];
    for (const territoryId of territories) {
      await rbac.authorize(tenantId, "TOUR_PLAN_OWN", territoryId, accessToken);
    }
  };

  return {
    list(tenantId: string, userId: string, accessToken: string) {
      return repository.listOwn(tenantId, userId, accessToken);
    },

    async get(tenantId: string, userId: string, planIdValue: unknown, accessToken: string) {
      const planId = uuid(planIdValue, "planId");
      const plan = await repository.getOwn(tenantId, userId, planId, accessToken);
      if (!plan) throw new TourPlanNotFoundError("Tour plan not found");
      return plan;
    },

    async save(
      tenantId: string,
      userId: string,
      planIdValue: unknown,
      accessToken: string,
      value: Record<string, unknown>,
    ) {
      const planId = planIdValue == null ? null : uuid(planIdValue, "planId");
      if (planId) {
        const existing = await repository.getOwn(tenantId, userId, planId, accessToken);
        if (!existing) throw new TourPlanNotFoundError("Tour plan not found");
        if (existing.status !== "DRAFT" && existing.status !== "RETURNED") throw new TourPlanConflictError("Tour plan is not editable");
      }

      const weekStart = parseWeekStart(value.weekStart);
      const days = normalizeDays(value.days, weekStart);
      await authorizeTerritories(tenantId, accessToken, days);

      const savedId = await repository.save(tenantId, userId, planId, weekStart, days);
      const saved = await repository.getOwn(tenantId, userId, savedId, accessToken);
      if (!saved) throw new TourPlanConflictError("Saved tour plan could not be reloaded");
      return saved;
    },

    async submit(
      tenantId: string,
      userId: string,
      planIdValue: unknown,
      accessToken: string,
    ) {
      const planId = uuid(planIdValue, "planId");
      const plan = await repository.getOwn(tenantId, userId, planId, accessToken);
      if (!plan) throw new TourPlanNotFoundError("Tour plan not found");
      if (plan.status !== "DRAFT" && plan.status !== "RETURNED") throw new TourPlanConflictError("Tour plan cannot be submitted from its current status");
      if (!plan.days.some((day) => day.stops.length > 0)) {
        throw new TourPlanConflictError("Tour plan must contain at least one stop before submission");
      }

      await authorizeTerritories(tenantId, accessToken, plan.days);
      await repository.submit(tenantId, userId, planId);
    },
  };
}
