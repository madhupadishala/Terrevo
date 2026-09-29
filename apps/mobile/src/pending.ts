import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export type PendingMutation<T> = {
  operationId: string;
  payload: T;
};

const PREFIX = "terrevo.pending.";

function storageKey(scope: string): string {
  return PREFIX + scope.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function getOrCreatePendingMutation<T>(
  scope: string,
  createPayload: () => Promise<T>,
): Promise<PendingMutation<T>> {
  const key = storageKey(scope);
  const raw = await SecureStore.getItemAsync(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PendingMutation<T>;
      if (typeof parsed.operationId === "string" && parsed.operationId && "payload" in parsed) {
        return parsed;
      }
    } catch {
      // Corrupt local retry state is discarded before a new operation is created.
    }
    await SecureStore.deleteItemAsync(key);
  }

  const pending: PendingMutation<T> = {
    operationId: Crypto.randomUUID(),
    payload: await createPayload(),
  };
  await SecureStore.setItemAsync(key, JSON.stringify(pending), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return pending;
}

export async function clearPendingMutation(scope: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(scope));
}
