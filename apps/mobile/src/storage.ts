import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { AuthSession } from "./types";

const SESSION_KEY = "terrevo.session.v1";
const TENANT_KEY = "terrevo.tenant.v1";
const DEVICE_KEY = "terrevo.installation.v1";

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function saveSession(session: AuthSession | null): Promise<void> {
  if (!session) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadTenantId(): Promise<string | null> {
  return SecureStore.getItemAsync(TENANT_KEY);
}

export async function saveTenantId(tenantId: string | null): Promise<void> {
  if (!tenantId) {
    await SecureStore.deleteItemAsync(TENANT_KEY);
    return;
  }
  await SecureStore.setItemAsync(TENANT_KEY, tenantId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_KEY, created, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return created;
}
