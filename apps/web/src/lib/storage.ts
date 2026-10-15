export interface StateStorage<R = unknown> {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => R;
  removeItem: (name: string) => R;
}

export interface DeferredStorage<TValue> {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: TValue) => void;
  removeItem: (name: string) => void;
  flush: () => void;
}

export function createMemoryStorage(): StateStorage {
  const store = new Map<string, string>();
  return {
    getItem: (name) => store.get(name) ?? null,
    setItem: (name, value) => {
      store.set(name, value);
    },
    removeItem: (name) => {
      store.delete(name);
    },
  };
}

function isStateStorage(
  storage: Partial<StateStorage> | null | undefined,
): storage is StateStorage {
  return (
    storage !== null &&
    storage !== undefined &&
    typeof storage.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function"
  );
}

export function resolveStorage(storage: Partial<StateStorage> | null | undefined): StateStorage {
  return isStateStorage(storage) ? storage : createMemoryStorage();
}

// Longest a value may wait unwritten while writes keep arriving. A pure debounce never fires
// during continuous typing, so a crash would lose everything since the last pause.
const DEFERRED_STORAGE_MAX_WAIT_MS = 1000;

/** Keep the latest value and serialize it when the debounce fires, the max wait passes, or `flush` runs. */
export function createDeferredStorage<TValue>(
  baseStorage: Partial<StateStorage> | null | undefined,
  serialize: (value: TValue) => string,
  debounceMs: number = 300,
  maxWaitMs: number = DEFERRED_STORAGE_MAX_WAIT_MS,
): DeferredStorage<TValue> {
  const resolvedStorage = resolveStorage(baseStorage);
  let pending: { readonly name: string; readonly value: TValue } | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    if (maxWaitTimer !== null) clearTimeout(maxWaitTimer);
    debounceTimer = null;
    maxWaitTimer = null;
  };
  const write = () => {
    clearTimers();
    const next = pending;
    pending = null;
    if (next) resolvedStorage.setItem(next.name, serialize(next.value));
  };

  return {
    getItem: (name) => resolvedStorage.getItem(name),
    setItem: (name, value) => {
      pending = { name, value };
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(write, debounceMs);
      maxWaitTimer ??= setTimeout(write, maxWaitMs);
    },
    removeItem: (name) => {
      clearTimers();
      pending = null;
      resolvedStorage.removeItem(name);
    },
    flush: write,
  };
}
