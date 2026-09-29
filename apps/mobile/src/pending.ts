import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export type PendingMutation<T> = {
  operationId: string;
  payload: T;
};

const PREFIX = "terrevo.pending.";
const PRESENCE_REF_KEY = "terrevo.pending.presence-ref.v1";

export type PendingPresenceRef = {
  userId: string;
  tenantId: string;
  visitId: string;
};

function storageKey(scope: string): string {
  return PREFIX + scope.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function loadPendingMutation<T>(scope: string): Promise<PendingMutation<T> | null> {
  const raw = await SecureStore.getItemAsync(storageKey(scope));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingMutation<T>;
    if (typeof parsed.operationId === "string" && parsed.operationId && "payload" in parsed) return parsed;
  } catch {
    // Invalid local retry state is cleared below.
  }
  await SecureStore.deleteItemAsync(storageKey(scope));
  return null;
}

export async function savePendingMutation<T>(scope: string, pending: PendingMutation<T>): Promise<void> {
  await SecureStore.setItemAsync(storageKey(scope), JSON.stringify(pending), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getOrCreatePendingMutation<T>(
  scope: string,
  createPayload: () => Promise<T>,
): Promise<PendingMutation<T>> {
  const key = storageKey(scope);
  const existing = await loadPendingMutation<T>(scope);
  if (existing) return existing;

  const pending: PendingMutation<T> = {
    operationId: Crypto.randomUUID(),
    payload: await createPayload(),
  };
  await savePendingMutation(scope, pending);
  return pending;
}

export async function clearPendingMutation(scope: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(scope));
}


export async function loadPendingPresenceRef(): Promise<PendingPresenceRef | null> {
  const raw = await SecureStore.getItemAsync(PRESENCE_REF_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPresenceRef;
    if (parsed.userId && parsed.tenantId && parsed.visitId) return parsed;
  } catch {
    // Invalid pointer is cleared below.
  }
  await SecureStore.deleteItemAsync(PRESENCE_REF_KEY);
  return null;
}

export async function rememberPendingPresenceRef(ref: PendingPresenceRef): Promise<void> {
  const existing = await loadPendingPresenceRef();
  if (existing && (
    existing.userId !== ref.userId ||
    existing.tenantId !== ref.tenantId ||
    existing.visitId !== ref.visitId
  )) {
    throw new Error("Another visit has unsynced presence evidence.");
  }
  await SecureStore.setItemAsync(PRESENCE_REF_KEY, JSON.stringify(ref), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearPendingPresenceRef(): Promise<void> {
  await SecureStore.deleteItemAsync(PRESENCE_REF_KEY);
}
