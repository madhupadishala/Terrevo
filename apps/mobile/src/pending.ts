import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export type PendingMutation<T> = {
  operationId: string;
  payload: T;
};

export type PendingPresence<T> = PendingMutation<T> & {
  userId: string;
  tenantId: string;
  visitId: string;
};

const PREFIX = "terrevo.pending.";
const PRESENCE_KEY = "terrevo.pending.presence.v1";
let mutationLock: Promise<unknown> = Promise.resolve();

function withMutationLock<T>(work: () => Promise<T>): Promise<T> {
  const next = mutationLock.then(work, work);
  mutationLock = next.catch(() => undefined);
  return next;
}

function storageKey(scope: string): string {
  return PREFIX + scope.replace(/[^A-Za-z0-9._-]/g, "_");
}

async function loadPendingMutationUnlocked<T>(scope: string): Promise<PendingMutation<T> | null> {
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

export async function loadPendingMutation<T>(scope: string): Promise<PendingMutation<T> | null> {
  return withMutationLock(() => loadPendingMutationUnlocked<T>(scope));
}

async function savePendingMutationUnlocked<T>(scope: string, pending: PendingMutation<T>): Promise<void> {
  await SecureStore.setItemAsync(storageKey(scope), JSON.stringify(pending), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getOrCreatePendingMutation<T>(
  scope: string,
  createPayload: () => Promise<T>,
): Promise<PendingMutation<T>> {
  const existing = await withMutationLock(() => loadPendingMutationUnlocked<T>(scope));
  if (existing) return existing;

  const payload = await createPayload();
  return withMutationLock(async () => {
    const raced = await loadPendingMutationUnlocked<T>(scope);
    if (raced) return raced;

    const pending: PendingMutation<T> = {
      operationId: Crypto.randomUUID(),
      payload,
    };
    await savePendingMutationUnlocked(scope, pending);
    return pending;
  });
}

export async function clearPendingMutation(scope: string): Promise<void> {
  await withMutationLock(() => SecureStore.deleteItemAsync(storageKey(scope)));
}

/** Clears one retry payload only when it is still the exact operation being replayed. */
export async function clearPendingMutationIfOperation(scope: string, operationId: string): Promise<boolean> {
  return withMutationLock(async () => {
    const pending = await loadPendingMutationUnlocked<unknown>(scope);
    if (!pending || pending.operationId !== operationId) return false;
    await SecureStore.deleteItemAsync(storageKey(scope));
    return true;
  });
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
