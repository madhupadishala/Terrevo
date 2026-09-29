export type SyncOperationKind =
  | "start"
  | "check-in"
  | "distribution"
  | "submit-tour"
  | "daily-timesheet-review"
  | "weekly-timesheet-submit"
  | "leave-submit"
  | "expense-save"
  | "expense-submit"
  | "joint-work-join"
  | "joint-work-leave"
  | "doctor-call"
  | "trade-call"
  | "rcpa"
  | "order"
  | "check-out";

export type ParsedSyncOperation = {
  kind: SyncOperationKind;
  targetId: string | null;
};

const TARGETED_KINDS = new Set<SyncOperationKind>([
  "start",
  "check-in",
  "distribution",
  "submit-tour",
  "daily-timesheet-review",
  "weekly-timesheet-submit",
  "expense-save",
  "expense-submit",
  "joint-work-join",
  "joint-work-leave",
  "doctor-call",
  "trade-call",
  "rcpa",
  "order",
  "check-out",
]);

export function parseSyncOperation(scope: string, userId: string, tenantId: string): ParsedSyncOperation | null {
  const prefix = `${tenantId}.${userId}.`;
  if (!scope.startsWith(prefix)) return null;
  const operation = scope.slice(prefix.length);
  if (operation === "leave-submit") return { kind: "leave-submit", targetId: null };

  const dot = operation.indexOf(".");
  if (dot <= 0 || dot === operation.length - 1) return null;
  const kind = operation.slice(0, dot) as SyncOperationKind;
  const targetId = operation.slice(dot + 1);
  if (!TARGETED_KINDS.has(kind) || !targetId) return null;
  return { kind, targetId };
}

export function syncErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error)) return null;
  const value = (error as { status?: unknown }).status;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function isDefinitiveSyncFailure(error: unknown): boolean {
  const status = syncErrorStatus(error);
  return status !== null && [400, 403, 404, 409].includes(status);
}

export function shouldStopSyncAfterFailure(error: unknown): boolean {
  if (isDefinitiveSyncFailure(error)) return false;
  const status = syncErrorStatus(error);
  if (status === null) return true;
  return status === 401 || status === 408 || status === 425 || status === 429 || status >= 500;
}

const AUTO_REPLAY_SAFE = new Set<SyncOperationKind>([
  "distribution",
  "daily-timesheet-review",
  "weekly-timesheet-submit",
  "leave-submit",
  "expense-save",
  "expense-submit",
  "doctor-call",
  "trade-call",
  "rcpa",
  "order",
]);

export function isAutoReplaySafe(kind: SyncOperationKind): boolean {
  return AUTO_REPLAY_SAFE.has(kind);
}
