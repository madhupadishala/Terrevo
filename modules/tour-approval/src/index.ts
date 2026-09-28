import type { RbacService } from "../../rbac/src/index.ts";
import type { TourPlan, TourPlanSummary } from "../../tour-planning/src/index.ts";

export const TOUR_DECISIONS = ["APPROVE", "REJECT", "RETURN"] as const;
export type TourDecision = typeof TOUR_DECISIONS[number];

export type TourApprovalRepository = {
  listPending(tenantId: string, accessToken: string): Promise<TourPlanSummary[]>;
  getForReview(tenantId: string, planId: string, accessToken: string): Promise<TourPlan | null>;
  decide(
    tenantId: string,
    actorUserId: string,
    planId: string,
    decision: TourDecision,
    comment: string | null,
  ): Promise<void>;
};

export class TourApprovalInputError extends Error {}
export class TourApprovalConflictError extends Error {}
export class TourApprovalNotFoundError extends Error {}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new TourApprovalInputError("planId must be a UUID");
  }
  return value;
}

function parseDecision(value: unknown): TourDecision {
  if (typeof value !== "string" || !TOUR_DECISIONS.includes(value as TourDecision)) {
    throw new TourApprovalInputError("Invalid tour decision");
  }
  return value as TourDecision;
}

function parseComment(value: unknown, required: boolean): string | null {
  if (value == null || value === "") {
    if (required) throw new TourApprovalInputError("Comment is required for reject/return");
    return null;
  }
  if (typeof value !== "string") throw new TourApprovalInputError("Invalid comment");
  const comment=value.trim();
  if (!comment || comment.length > 1000) throw new TourApprovalInputError("Invalid comment");
  return comment;
}

export function createTourApprovalService(repository: TourApprovalRepository, rbac: RbacService) {
  return {
    listPending(tenantId: string, accessToken: string) {
      return repository.listPending(tenantId, accessToken);
    },

    async get(tenantId: string, planIdValue: unknown, accessToken: string) {
      const planId=uuid(planIdValue);
      const plan=await repository.getForReview(tenantId, planId, accessToken);
      if (!plan) throw new TourApprovalNotFoundError("Tour plan not found");
      return plan;
    },

    async decide(
      tenantId: string,
      actorUserId: string,
      planIdValue: unknown,
      accessToken: string,
      value: Record<string, unknown>,
    ) {
      const planId=uuid(planIdValue);
      const decision=parseDecision(value.decision);
      const comment=parseComment(value.comment, decision !== "APPROVE");
      const plan=await repository.getForReview(tenantId, planId, accessToken);
      if (!plan) throw new TourApprovalNotFoundError("Tour plan not found");
      if (plan.status !== "SUBMITTED") {
        throw new TourApprovalConflictError("Only submitted tour plans can be reviewed");
      }
      const territories=[...new Set(plan.days.map((day)=>day.territoryId))];
      if (territories.length === 0) throw new TourApprovalConflictError("Tour plan has no reviewable days");
      for (const territoryId of territories) {
        await rbac.authorize(tenantId, "TOUR_APPROVE", territoryId, accessToken);
      }
      await repository.decide(tenantId, actorUserId, planId, decision, comment);
    },
  };
}
