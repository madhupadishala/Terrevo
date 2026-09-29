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

export function syncModeFor(action: SyncAction): SyncMode {
  return AUTO_ACTIONS.has(action) ? "AUTO" : "MANUAL";
}

export function retryDelayMs(attempts: number): number {
  const step = Math.max(1, attempts);
  return Math.min(60 * 60_000, 30_000 * (2 ** Math.min(step - 1, 7)));
}

export function nextRetryAt(now: Date, attempts: number): string {
  return new Date(now.getTime() + retryDelayMs(attempts)).toISOString();
}

export function isSyncDue(item: SyncQueueItem, now = new Date()): boolean {
  return item.state === "QUEUED"
    && item.mode === "AUTO"
    && (!item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= now.getTime());
}

export function summarizeSyncQueue(items: SyncQueueItem[]) {
  return items.reduce((summary, item) => {
    if (item.state === "DEAD_LETTER") summary.needsAttention += 1;
    else if (item.mode === "MANUAL") summary.manual += 1;
    else summary.waiting += 1;
    return summary;
  }, { waiting: 0, manual: 0, needsAttention: 0 });
}
