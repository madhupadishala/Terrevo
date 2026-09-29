import type { TerrevoApi } from "./api";
import type { PendingMutation } from "./pending";
import type { PresencePoint } from "./presence";
import { parseSyncOperation } from "./sync";
import type { DistributionLine, DoctorCallProductInput, ExpenseLine, OrderLine, RcpaLine } from "./types";

type ReplayApi = Pick<TerrevoApi,
  | "startTour"
  | "checkIn"
  | "distribute"
  | "submitTour"
  | "reviewDailyTimesheet"
  | "submitWeeklyTimesheet"
  | "submitLeave"
  | "saveExpense"
  | "submitExpense"
  | "joinJointWork"
  | "leaveJointWork"
  | "saveDoctorCall"
  | "saveTradeCall"
  | "saveRcpa"
  | "saveOrder"
  | "checkOut"
>;

function requireTarget(targetId: string | null): string {
  if (!targetId) throw new Error("Queued sync action is missing its target.");
  return targetId;
}

export async function replayPendingMutation(
  api: ReplayApi,
  scope: string,
  pending: PendingMutation<unknown>,
  userId: string,
  tenantId: string,
): Promise<void> {
  const operation = parseSyncOperation(scope, userId, tenantId);
  if (!operation) throw new Error("Queued sync action does not belong to the active account and company.");
  const targetId = operation.targetId;

  switch (operation.kind) {
    case "start": {
      const payload = pending.payload as { location: PresencePoint; deviceId: string; appVersion: string };
      await api.startTour({ operationId: pending.operationId, planDayId: requireTarget(targetId), ...payload });
      return;
    }
    case "check-in": {
      const payload = pending.payload as { location: PresencePoint; exceptionReason: string | null };
      await api.checkIn({ operationId: pending.operationId, planStopId: requireTarget(targetId), ...payload });
      return;
    }
    case "distribution": {
      const payload = pending.payload as { items: DistributionLine[] };
      await api.distribute(requireTarget(targetId), { operationId: pending.operationId, items: payload.items });
      return;
    }
    case "submit-tour": {
      const payload = pending.payload as { shortDayReason: string | null };
      await api.submitTour({ operationId: pending.operationId, shortDayReason: payload.shortDayReason });
      return;
    }
    case "daily-timesheet-review": {
      const payload = pending.payload as { remarks: string | null };
      await api.reviewDailyTimesheet(requireTarget(targetId), { operationId: pending.operationId, remarks: payload.remarks });
      return;
    }
    case "weekly-timesheet-submit": {
      const payload = pending.payload as { comment: string | null };
      await api.submitWeeklyTimesheet(requireTarget(targetId), { operationId: pending.operationId, comment: payload.comment });
      return;
    }
    case "leave-submit": {
      const payload = pending.payload as {
        leaveType: "FULL_DAY" | "HALF_DAY";
        startDate: string;
        endDate: string;
        reason: string;
      };
      await api.submitLeave({ operationId: pending.operationId, ...payload });
      return;
    }
    case "expense-save": {
      const payload = pending.payload as { currencyCode: string; lines: ExpenseLine[] };
      await api.saveExpense(requireTarget(targetId), { operationId: pending.operationId, ...payload });
      return;
    }
    case "expense-submit": {
      const payload = pending.payload as { comment: string | null };
      await api.submitExpense(requireTarget(targetId), { operationId: pending.operationId, comment: payload.comment });
      return;
    }
    case "joint-work-join":
    case "joint-work-leave": {
      const payload = pending.payload as { location: PresencePoint };
      const input = { operationId: pending.operationId, location: payload.location };
      if (operation.kind === "joint-work-join") await api.joinJointWork(requireTarget(targetId), input);
      else await api.leaveJointWork(requireTarget(targetId), input);
      return;
    }
    case "doctor-call": {
      const payload = pending.payload as {
        callOutcome: string;
        remarks: string | null;
        nextAction: string | null;
        products: DoctorCallProductInput[];
      };
      await api.saveDoctorCall(requireTarget(targetId), { operationId: pending.operationId, ...payload });
      return;
    }
    case "trade-call": {
      const payload = pending.payload as { outcome: string; remarks: string | null; nextAction: string | null };
      await api.saveTradeCall(requireTarget(targetId), { operationId: pending.operationId, ...payload });
      return;
    }
    case "rcpa": {
      const payload = pending.payload as { lines: RcpaLine[] };
      await api.saveRcpa(requireTarget(targetId), { operationId: pending.operationId, lines: payload.lines });
      return;
    }
    case "order": {
      const payload = pending.payload as { remarks: string | null; lines: OrderLine[] };
      await api.saveOrder(requireTarget(targetId), { operationId: pending.operationId, ...payload });
      return;
    }
    case "check-out": {
      const payload = pending.payload as { location: PresencePoint };
      await api.checkOut(requireTarget(targetId), { operationId: pending.operationId, location: payload.location });
      return;
    }
  }
}
