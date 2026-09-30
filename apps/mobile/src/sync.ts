export type SyncMode = "AUTO" | "MANUAL";
export type SyncState = "QUEUED" | "DEAD_LETTER";

export type SyncAction =
  | "start-tour"
  | "check-in"
  | "distribution"
  | "doctor-call"
  | "trade-call"
  | "rcpa"
  | "order"
  | "check-out"
  | "submit-tour"
  | "daily-review"
  | "weekly-submit"
  | "leave-submit"
  | "expense-save"
  | "expense-submit"
  | "joint-work-join"
  | "joint-work-leave";

export type SyncQueueItem = {
  scope: string;
  userId: string;
  tenantId: string;
  action: SyncAction;
  targetId: string | null;
  operationId: string;
  payload: unknown;
  mode: SyncMode;
  state: SyncState;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  lastError: string | null;
};

const SYNC_ACTIONS = new Set<SyncAction>([
  "start-tour", "check-in", "distribution", "doctor-call", "trade-call", "rcpa", "order", "check-out", "submit-tour",
  "daily-review", "weekly-submit", "leave-submit", "expense-save", "expense-submit", "joint-work-join", "joint-work-leave",
]);

const AUTO_ACTIONS = new Set<SyncAction>([
  "distribution",
  "doctor-call",
  "trade-call",
  "rcpa",
  "order",
  "daily-review",
  "weekly-submit",
  "leave-submit",
  "expense-save",
  "expense-submit",
]);

/** Returns whether an action is safe for unattended replay. */
export function syncModeFor(action: SyncAction): SyncMode {
  return AUTO_ACTIONS.has(action) ? "AUTO" : "MANUAL";
}

/** Returns bounded exponential retry delay for a queued mutation. */
export function retryDelayMs(attempts: number): number {
  const step = Math.max(1, attempts);
  return Math.min(60 * 60_000, 30_000 * (2 ** Math.min(step - 1, 7)));
}

/** Calculates the next retry timestamp from trusted local queue metadata. */
export function nextRetryAt(now: Date, attempts: number): string {
  return new Date(now.getTime() + retryDelayMs(attempts)).toISOString();
}

/** Returns true when an automatic queue item is due for replay. */
export function isSyncDue(item: SyncQueueItem, now = new Date()): boolean {
  return item.state === "QUEUED"
    && item.mode === "AUTO"
    && (!item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= now.getTime());
}

/** Validates persisted queue records before they can reach replay logic. */
export function isSyncQueueItem(value: unknown): value is SyncQueueItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const validDate = (date: unknown) => typeof date === "string" && Number.isFinite(Date.parse(date));
  return typeof item.scope === "string" && item.scope.length > 0
    && typeof item.userId === "string" && item.userId.length > 0
    && typeof item.tenantId === "string" && item.tenantId.length > 0
    && typeof item.operationId === "string" && item.operationId.length > 0
    && typeof item.action === "string" && SYNC_ACTIONS.has(item.action as SyncAction)
    && (item.targetId === null || typeof item.targetId === "string")
    && (item.mode === "AUTO" || item.mode === "MANUAL")
    && (item.state === "QUEUED" || item.state === "DEAD_LETTER")
    && Number.isInteger(item.attempts) && (item.attempts as number) >= 0
    && validDate(item.createdAt)
    && validDate(item.updatedAt)
    && (item.nextAttemptAt === null || validDate(item.nextAttemptAt))
    && (item.lastError === null || typeof item.lastError === "string")
    && Object.prototype.hasOwnProperty.call(item, "payload");
}

/** Summarizes queue state for the owner-scoped sync status UI. */
export function summarizeSyncQueue(items: SyncQueueItem[]) {
  return items.reduce((summary, item) => {
    if (item.state === "DEAD_LETTER") summary.needsAttention += 1;
    else if (item.mode === "MANUAL") summary.manual += 1;
    else summary.waiting += 1;
    return summary;
  }, { waiting: 0, manual: 0, needsAttention: 0 });
}
