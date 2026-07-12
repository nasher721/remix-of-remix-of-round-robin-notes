export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Storage can be unavailable even when `window` exists (privacy mode, blocked
 * third-party storage, or a throwing browser getter). Resolve it per operation
 * and retain an in-memory fallback so callers never crash during render.
 */
export const createSafeStorage = (
  storageName: "localStorage" | "sessionStorage" = "localStorage",
): StorageLike => {
  const memoryStore = new Map<string, string>();
  const pendingOverrides = new Map<string, string | null>();

  const getBrowserStorage = (): Storage | null => {
    if (typeof window === "undefined") return null;
    try {
      return window[storageName];
    } catch {
      return null;
    }
  };

  return {
    getItem: (key) => {
      if (pendingOverrides.has(key)) {
        return pendingOverrides.get(key) ?? null;
      }

      try {
        const storage = getBrowserStorage();
        if (storage) {
          const browserValue = storage.getItem(key);
          if (browserValue !== null) {
            memoryStore.set(key, browserValue);
            return browserValue;
          }
          memoryStore.delete(key);
          return null;
        }
      } catch {
        // Fall through to the in-memory value.
      }
      return memoryStore.get(key) ?? null;
    },
    setItem: (key, value) => {
      memoryStore.set(key, value);
      try {
        const storage = getBrowserStorage();
        if (!storage) throw new Error("Browser storage unavailable");
        storage.setItem(key, value);
        pendingOverrides.delete(key);
      } catch {
        // A stale browser value must not override the newer in-memory write.
        pendingOverrides.set(key, value);
      }
    },
    removeItem: (key) => {
      memoryStore.delete(key);
      try {
        const storage = getBrowserStorage();
        if (!storage) throw new Error("Browser storage unavailable");
        storage.removeItem(key);
        pendingOverrides.delete(key);
      } catch {
        // Retain a tombstone so a stale browser value cannot reappear.
        pendingOverrides.set(key, null);
      }
    },
  };
};

export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");
