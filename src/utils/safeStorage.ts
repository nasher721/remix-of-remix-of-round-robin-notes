type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const createSafeStorage = (): StorageLike => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  const memoryStore = new Map<string, string>();
  return {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, value) => {
      memoryStore.set(key, value);
    },
    removeItem: (key) => {
      memoryStore.delete(key);
    },
  };
};
