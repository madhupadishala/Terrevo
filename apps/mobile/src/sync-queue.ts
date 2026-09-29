import * as SecureStore from "expo-secure-store";
import type { PendingMutation } from "./pending";
import { nextRetryAt, syncModeFor, type SyncAction, type SyncQueueItem } from "./sync";

const MANIFEST_KEY = "terrevo.sync.manifest.v1";
const ITEM_PREFIX = "terrevo.sync.item.v1.";

function itemKey(scope: string): string {
  return ITEM_PREFIX + scope.replace(/[^A-Za-z0-9._-]/g, "_");
}

async function loadManifest(): Promise<string[]> {
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

async function saveManifest(scopes: string[]): Promise<void> {
  if (scopes.length === 0) {
    await SecureStore.deleteItemAsync(MANIFEST_KEY);
    return;
  }
  await SecureStore.setItemAsync(MANIFEST_KEY, JSON.stringify([...new Set(scopes)]), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function saveItem(item: SyncQueueItem): Promise<void> {
  await SecureStore.setItemAsync(itemKey(item.scope), JSON.stringify(item), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  const manifest = await loadManifest();
  if (!manifest.includes(item.scope)) await saveManifest([...manifest, item.scope]);
}

export async function listSyncQueue(userId: string, tenantId: string): Promise<SyncQueueItem[]> {
  const manifest = await loadManifest();
  const validScopes: string[] = [];
  const items: SyncQueueItem[] = [];
  for (const scope of manifest) {
    const raw = await SecureStore.getItemAsync(itemKey(scope));
    if (!raw) continue;
    try {
      const item = JSON.parse(raw) as SyncQueueItem;
      if (!item.scope || !item.userId || !item.tenantId || !item.operationId || !item.action) throw new Error("invalid");
      validScopes.push(scope);
      if (item.userId === userId && item.tenantId === tenantId) items.push(item);
    } catch {
      await SecureStore.deleteItemAsync(itemKey(scope));
    }
  }
  if (validScopes.length !== manifest.length) await saveManifest(validScopes);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function queuePendingMutation(input: {
  scope: string;
  userId: string;
  tenantId: string;
  action: SyncAction;
  targetId?: string | null;
  pending: PendingMutation<unknown>;
  error?: string | null;
}): Promise<void> {
  const existing = (await listSyncQueue(input.userId, input.tenantId)).find((item) => item.scope === input.scope);
  const now = new Date();
  const attempts = (existing?.attempts ?? 0) + 1;
  await saveItem({
    scope: input.scope,
    userId: input.userId,
    tenantId: input.tenantId,
    action: input.action,
    targetId: input.targetId ?? null,
    operationId: input.pending.operationId,
    payload: input.pending.payload,
    mode: syncModeFor(input.action),
    state: "QUEUED",
    attempts,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    nextAttemptAt: syncModeFor(input.action) === "AUTO" ? nextRetryAt(now, attempts) : null,
    lastError: input.error ?? null,
  });
}

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

export async function deadLetterSyncItem(item: SyncQueueItem, error: string): Promise<void> {
  await saveItem({
    ...item,
    state: "DEAD_LETTER",
    updatedAt: new Date().toISOString(),
    nextAttemptAt: null,
    lastError: error,
  });
}

export async function removeSyncItem(scope: string): Promise<void> {
  await SecureStore.deleteItemAsync(itemKey(scope));
  const manifest = await loadManifest();
  if (manifest.includes(scope)) await saveManifest(manifest.filter((value) => value !== scope));
}
