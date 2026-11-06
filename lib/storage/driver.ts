/**
 * Storage driver abstraction. The app only talks to this interface, so swapping localStorage for
 * Supabase (or anything else) means writing one new driver; nothing else changes.
 * Every method is async, even though localStorage is sync, so a remote driver fits the same shape.
 */
export interface StorageDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
  }
}

const PREFIX = "syslab:v1:";

export function createLocalStorageDriver(store?: Storage): StorageDriver {
  const getStore = (): Storage => {
    const s = store ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!s) throw new StorageError("Browser storage is not available.");
    return s;
  };
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = getStore().getItem(PREFIX + key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch (cause) {
        throw new StorageError(`Saved data for "${key}" is corrupted.`, { cause });
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      try {
        getStore().setItem(PREFIX + key, JSON.stringify(value));
      } catch (cause) {
        throw new StorageError("Could not save. Browser storage may be full or disabled.", { cause });
      }
    },
    async remove(key: string): Promise<void> {
      getStore().removeItem(PREFIX + key);
    },
  };
}

/** In-memory driver for tests. */
export function createMemoryDriver(): StorageDriver {
  const m = new Map<string, string>();
  return {
    async get<T>(key: string) {
      const raw = m.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    async set<T>(key: string, value: T) {
      m.set(key, JSON.stringify(value));
    },
    async remove(key: string) {
      m.delete(key);
    },
  };
}
