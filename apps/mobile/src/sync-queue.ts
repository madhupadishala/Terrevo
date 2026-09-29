import * as SecureStore from "expo-secure-store";
import type { PendingMutation } from "./pending";
import { isSyncQueueItem, nextRetryAt, syncModeFor, type SyncAction, type SyncQueueItem } from "./sync";

const MANIFEST_KEY = "terrevo.sync.manifest.v1";
const ITEM_PREFIX = "terrevo.sync.item.v1.";
let manifestLock: Promise<unknown> = Promise.resolve();

function withManifestLock<T>(work: () => Promise<T>): Promise<T> {
  const next = manifestLock.then(work, work);
  manifestLock = next.catch(() => undefined);
  return next;
}

function entryId(scope: string, operationId: string): string {
  return `${scope}::${operationId}`;
}

function itemKey(id: string): string {
  return ITEM_PREFIX + id.replace(/[^A-Za-z0-9._-]/g, "_");
}

async function loadManifestUnlocked(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(MANIFEST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) return [...new Set(parsed)];
  } catch {
    // Invalid queue manifest is reset below.
  }
  await SecureStore.deleteItemAsync(MANIFEST_KEY);
  return [];
}

async function saveManifestUnlocked(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    await SecureStore.deleteItemAsync(MANIFEST_KEY);
    return;
  }
  await SecureStore.setItemAsync(MANIFEST_KEY, JSON.stringify([...new Set(ids)]), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** Persists one queue item and its manifest entry atomically with respect to other queue operations. */
async function saveItem(item: SyncQueueItem): Promise<void> {
  await withManifestLock(async () => {
    const id = entryId(item.scope, item.operationId);
    await SecureStore.setItemAsync(itemKey(id), JSON.stringify(item), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    const manifest = await loadManifestUnlocked();
    if (!manifest.includes(id)) await saveManifestUnlocked([...manifest, id]);
  });
}

/** Lists only valid queue items belonging to the supplied authenticated identity and tenant. */
export async function listSyncQueue(userId: string, tenantId: string): Promise<SyncQueueItem[]> {
  return withManifestLock(async () => {
    const manifest = await loadManifestUnlocked();
    const validIds: string[] = [];
    const items: SyncQueueItem[] = [];
    for (const id of manifest) {
      const raw = await SecureStore.getItemAsync(itemKey(id));
      if (!raw) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isSyncQueueItem(parsed) || entryId(parsed.scope, parsed.operationId) !== id) throw new Error("invalid");
        validIds.push(id);
        if (parsed.userId === userId && parsed.tenantId === tenantId) items.push(parsed);
      } catch {
        await SecureStore.deleteItemAsync(itemKey(id));
      }
    }
    if (validIds.length !== manifest.length) await saveManifestUnlocked(validIds);
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
}

/** Stores a failed mutation without overwriting a dead letter from an older operation on the same business scope. */
export async function queuePendingMutation(input: {
  scope: string;
  userId: string;
  tenantId: string;
  action: SyncAction;
  targetId?: string | null;
  pending: PendingMutation<unknown>;
  error?: string | null;
}): Promise<void> {
  const existing = (await listSyncQueue(input.userId, input.tenantId)).find(
    (item) => item.scope === input.scope && item.operationId === input.pending.operationId,
  );
  const now = new Date();
  const attempts = (existing?.attempts ?? 0) + 1;
  const mode = syncModeFor(input.action);
  await saveItem({
    scope: input.scope,
    userId: input.userId,
    tenantId: input.tenantId,
    action: input.action,
    targetId: input.targetId ?? null,
    operationId: input.pending.operationId,
    payload: input.pending.payload,
    mode,
    state: existing?.state === "DEAD_LETTER" ? "DEAD_LETTER" : "QUEUED",
    attempts,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    nextAttemptAt: existing?.state === "DEAD_LETTER" ? null : mode === "AUTO" ? nextRetryAt(now, attempts) : null,
    lastError: input.error ?? null,
  });
}

/** Updates retry metadata while preserving the original operation ID and queue identity. */
export async function markSyncAttempt(item: SyncQueueItem, error: string | null): Promise<void> {
  const attempts = item.attempts + 1;
  const now = new Date();
  await saveItem({
    ...item,
    attempts,
    updatedAt: now.toISOString(),
    nextAttemptAt: item.mode === "AUTO" ? nextRetryAt(now, attempts) : null,
    lastError: error,
  });
}

/** Moves one exact operation to dead-letter state for explicit user attention. */
export async function deadLetterSyncItem(item: SyncQueueItem, error: string): Promise<void> {
  await saveItem({
    ...item,
    state: "DEAD_LETTER",
    updatedAt: new Date().toISOString(),
    nextAttemptAt: null,
    lastError: error,
  });
}

/** Removes one exact operation without deleting another operation or dead letter sharing the same business scope. */
export async function removeSyncItem(scope: string, operationId: string): Promise<void> {
  await withManifestLock(async () => {
    const id = entryId(scope, operationId);
    await SecureStore.deleteItemAsync(itemKey(id));
    const manifest = await loadManifestUnlocked();
    if (manifest.includes(id)) await saveManifestUnlocked(manifest.filter((value) => value !== id));
  });
}
