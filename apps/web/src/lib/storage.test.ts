import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDeferredStorage, createMemoryStorage } from "./storage";

describe("createDeferredStorage crash safety", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("persists a draft within the max wait while the user keeps typing (crash point: draft)", () => {
    const base = createMemoryStorage();
    const storage = createDeferredStorage<string>(base, (value) => value, 300);
    // Typing every 100 ms never leaves a 300 ms pause, so a pure debounce never writes.
    for (let i = 1; i <= 30; i += 1) {
      storage.setItem("draft", `text-${i}`);
      vi.advanceTimersByTime(100);
    }
    // The app is killed here: no flush, no beforeunload. 3 s of typing must be on disk.
    const saved = base.getItem("draft") as string | null;
    expect(saved).not.toBeNull();
    const savedIndex = Number(saved!.slice("text-".length));
    expect(savedIndex).toBeGreaterThanOrEqual(30 - 10);
  });

  it("still writes the last value after a normal pause", () => {
    const base = createMemoryStorage();
    const storage = createDeferredStorage<string>(base, (value) => value, 300);
    storage.setItem("draft", "final");
    vi.advanceTimersByTime(300);
    expect(base.getItem("draft")).toBe("final");
  });

  it("flush writes the pending value at once", () => {
    const base = createMemoryStorage();
    const storage = createDeferredStorage<string>(base, (value) => value, 300);
    storage.setItem("draft", "pending");
    storage.flush();
    expect(base.getItem("draft")).toBe("pending");
  });
});
