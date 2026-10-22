export const SESSION_STORAGE_KEY = {
  TRANSFER_DRAFT: "smw.transfer-draft",
} as const;

export interface SafeStorage {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

export const safeSessionStorage: SafeStorage = {
  getItem(name) {
    try {
      return window.sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.sessionStorage.setItem(name, value);
    } catch {}
  },
  removeItem(name) {
    try {
      window.sessionStorage.removeItem(name);
    } catch {}
  },
};

const clearListeners = new Set<() => void>();

export function onClientSessionClear(listener: () => void): () => void {
  clearListeners.add(listener);

  return () => {
    clearListeners.delete(listener);
  };
}

export function clearClientSession(): void {
  clearListeners.forEach((listener) => listener());

  for (const key of Object.values(SESSION_STORAGE_KEY)) {
    safeSessionStorage.removeItem(key);
  }
}
