import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export type PendingMutationStatus = "PENDING" | "DEAD_LETTER";

export type PendingMutation<T> = {
  operationId: string;
  payload: T;
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  status: PendingMutationStatus;
};

export type PendingMutationSummary = Omit<PendingMutation<unknown>, "payload"> & {
  scope: string;
};

export type PendingPresence<T> = {
  operationId: string;
  payload: T;
  userId: string;
  tenantId: string;
  visitId: string;
};

const PREFIX = "terrevo.pending.";
const INDEX_PREFIX = "terrevo.pending.index.v2.";
const PRESENCE_KEY = "terrevo.pending.presence.v1";
const indexLocks = new Map<string, Promise<void>>();

function storageKey(scope: string): string {
  return PREFIX + scope.replace(/[^A-Za-z0-9._-]/g, "_");
}

function indexKey(userId: string, tenantId: string): string {
  return INDEX_PREFIX + `${tenantId}.${userId}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

function scopeIdentity(scope: string): { tenantId: string; userId: string } | null {
  const parts = scope.split(".");
  if (parts.length < 3 || !parts[0] || !parts[1]) return null;
  return { tenantId: parts[0], userId: parts[1] };
}

async function loadIndex(userId: string, tenantId: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(indexKey(userId, tenantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("invalid index");
    return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0))];
  } catch {
    await SecureStore.deleteItemAsync(indexKey(userId, tenantId));
    return [];
  }
}

async function saveIndex(userId: string, tenantId: string, scopes: string[]): Promise<void> {
  if (scopes.length === 0) {
    await SecureStore.deleteItemAsync(indexKey(userId, tenantId));
    return;
  }
  await SecureStore.setItemAsync(indexKey(userId, tenantId), JSON.stringify(scopes), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function withIndexLock(key: string, action: () => Promise<void>): Promise<void> {
  const prior = indexLocks.get(key) ?? Promise.resolve();
  const next = prior.then(action, action);
  const tracked = next.catch(() => {});
  indexLocks.set(key, tracked);
  try {
    await next;
  } finally {
    if (indexLocks.get(key) === tracked) indexLocks.delete(key);
  }
}

async function registerScope(scope: string): Promise<void> {
  const identity = scopeIdentity(scope);
  if (!identity) return;
  const key = indexKey(identity.userId, identity.tenantId);
  await withIndexLock(key, async () => {
    const scopes = await loadIndex(identity.userId, identity.tenantId);
    if (scopes.includes(scope)) return;
    await saveIndex(identity.userId, identity.tenantId, [...scopes, scope]);
  });
}

async function unregisterScope(scope: string): Promise<void> {
  const identity = scopeIdentity(scope);
  if (!identity) return;
  const key = indexKey(identity.userId, identity.tenantId);
  await withIndexLock(key, async () => {
    const scopes = await loadIndex(identity.userId, identity.tenantId);
    if (!scopes.includes(scope)) return;
    await saveIndex(identity.userId, identity.tenantId, scopes.filter((item) => item !== scope));
  });
}

function normalizePending<T>(value: unknown): PendingMutation<T> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PendingMutation<T>> & { operationId?: unknown; payload?: T };
  if (typeof raw.operationId !== "string" || !raw.operationId || !("payload" in raw)) return null;
  return {
    operationId: raw.operationId,
    payload: raw.payload as T,
    createdAt: typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : new Date(0).toISOString(),
    attempts: typeof raw.attempts === "number" && Number.isInteger(raw.attempts) && raw.attempts >= 0 ? raw.attempts : 0,
    lastAttemptAt: typeof raw.lastAttemptAt === "string" ? raw.lastAttemptAt : null,
    lastError: typeof raw.lastError === "string" ? raw.lastError : null,
    status: raw.status === "DEAD_LETTER" ? "DEAD_LETTER" : "PENDING",
  };
}

export async function loadPendingMutation<T>(scope: string): Promise<PendingMutation<T> | null> {
  const raw = await SecureStore.getItemAsync(storageKey(scope));
  if (!raw) {
    await unregisterScope(scope);
    return null;
  }
  try {
    const pending = normalizePending<T>(JSON.parse(raw));
    if (pending) {
      await registerScope(scope);
      return pending;
    }
  } catch {
    // Invalid local retry state is cleared below.
  }
  await SecureStore.deleteItemAsync(storageKey(scope));
  await unregisterScope(scope);
  return null;
}

async function savePendingMutation<T>(scope: string, pending: PendingMutation<T>): Promise<void> {
  await SecureStore.setItemAsync(storageKey(scope), JSON.stringify(pending), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await registerScope(scope);
}

export async function getOrCreatePendingMutation<T>(
  scope: string,
  createPayload: () => Promise<T>,
): Promise<PendingMutation<T>> {
  const existing = await loadPendingMutation<T>(scope);
  const now = new Date().toISOString();
  if (existing && existing.status !== "DEAD_LETTER") {
    const retry: PendingMutation<T> = {
      ...existing,
      attempts: existing.attempts + 1,
      lastAttemptAt: now,
      lastError: null,
      status: "PENDING",
    };
    await savePendingMutation(scope, retry);
    return retry;
  }
  if (existing?.status === "DEAD_LETTER") {
    // A foreground resubmission is a corrected user action, not a replay of rejected data.
    await clearPendingMutation(scope);
  }

  const pending: PendingMutation<T> = {
    operationId: Crypto.randomUUID(),
    payload: await createPayload(),
    createdAt: now,
    attempts: 1,
    lastAttemptAt: now,
    lastError: null,
    status: "PENDING",
  };
  await savePendingMutation(scope, pending);
  return pending;
}

export async function markPendingMutationAttempt(scope: string): Promise<PendingMutation<unknown> | null> {
  const pending = await loadPendingMutation<unknown>(scope);
  if (!pending) return null;
  const updated: PendingMutation<unknown> = {
    ...pending,
    attempts: pending.attempts + 1,
    lastAttemptAt: new Date().toISOString(),
    status: "PENDING",
  };
  await savePendingMutation(scope, updated);
  return updated;
}

export async function markPendingMutationFailure(
  scope: string,
  error: string,
  deadLetter: boolean,
): Promise<void> {
  const pending = await loadPendingMutation<unknown>(scope);
  if (!pending) return;
  await savePendingMutation(scope, {
    ...pending,
    lastError: error.slice(0, 500),
    status: deadLetter ? "DEAD_LETTER" : "PENDING",
  });
}

export async function revivePendingMutation(scope: string): Promise<void> {
  const pending = await loadPendingMutation<unknown>(scope);
  if (!pending) return;
  await savePendingMutation(scope, {
    ...pending,
    lastError: null,
    status: "PENDING",
  });
}

export async function listPendingMutations(userId: string, tenantId: string): Promise<PendingMutationSummary[]> {
  const scopes = await loadIndex(userId, tenantId);
  const result: PendingMutationSummary[] = [];
  for (const scope of scopes) {
    const identity = scopeIdentity(scope);
    if (!identity || identity.userId !== userId || identity.tenantId !== tenantId) continue;
    const pending = await loadPendingMutation<unknown>(scope);
    if (!pending) continue;
    const { payload: _payload, ...summary } = pending;
    result.push({ scope, ...summary });
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function clearPendingMutation(scope: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(scope));
  await unregisterScope(scope);
}

export async function loadPendingPresence<T>(): Promise<PendingPresence<T> | null> {
  const raw = await SecureStore.getItemAsync(PRESENCE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPresence<T>;
    if (
      typeof parsed.operationId === "string" && parsed.operationId &&
      parsed.userId && parsed.tenantId && parsed.visitId &&
      "payload" in parsed
    ) return parsed;
  } catch {
    // Invalid local presence state is cleared below.
  }
  await SecureStore.deleteItemAsync(PRESENCE_KEY);
  return null;
}

export async function getOrCreatePendingPresence<T>(
  context: { userId: string; tenantId: string; visitId: string },
  createPayload: () => Promise<T>,
): Promise<PendingPresence<T>> {
  const existing = await loadPendingPresence<T>();
  if (existing) {
    if (
      existing.userId !== context.userId ||
      existing.tenantId !== context.tenantId ||
      existing.visitId !== context.visitId
    ) {
      throw new Error("Another visit has unsynced presence evidence.");
    }
    return existing;
  }

  const pending: PendingPresence<T> = {
    ...context,
    operationId: Crypto.randomUUID(),
    payload: await createPayload(),
  };
  await savePendingPresence(pending);
  return pending;
}

export async function savePendingPresence<T>(pending: PendingPresence<T>): Promise<void> {
  await SecureStore.setItemAsync(PRESENCE_KEY, JSON.stringify(pending), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearPendingPresence(): Promise<void> {
  await SecureStore.deleteItemAsync(PRESENCE_KEY);
}
