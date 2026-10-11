import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { startScribeStatusPolling, scribeStatusLabel } from "./server.ts";

function visibility() {
  const listeners = new Set<() => void>();
  const page = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  return {
    page,
    change(state: DocumentVisibilityState) {
      page.visibilityState = state;
      listeners.forEach((listener) => listener());
    },
    listeners,
  };
}

afterEach(() => vi.useRealTimers());
describe("Scribe status polling", () => {
  it("reads immediately and every five seconds while visible", async () => {
    vi.useFakeTimers();
    const { page } = visibility();
    const read = vi.fn(async () => {});
    const stop = startScribeStatusPolling(page, read);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });
  it("never overlaps a pending read", async () => {
    vi.useFakeTimers();
    const { page } = visibility();
    let resolve!: () => void;
    const read = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const stop = startScribeStatusPolling(page, read);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(1);
    resolve();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });
  it("cancels hidden and unmounted reads, resumes immediately, removes its listener", async () => {
    vi.useFakeTimers();
    const { page, change, listeners } = visibility();
    const signals: AbortSignal[] = [];
    const read = vi.fn(async (signal: AbortSignal) => {
      signals.push(signal);
    });
    const stop = startScribeStatusPolling(page, read);
    change("hidden");
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(1);
    change("visible");
    expect(read).toHaveBeenCalledTimes(2);
    stop();
    expect(signals[1]?.aborted).toBe(true);
    expect(listeners.size).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("does not read an initially hidden page and retries failed reads", async () => {
    vi.useFakeTimers();
    const { page, change } = visibility();
    change("hidden");
    const read = vi.fn(async () => {
      throw new Error("offline");
    });
    const stop = startScribeStatusPolling(page, read);
    expect(read).not.toHaveBeenCalled();
    change("visible");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("Scribe status labels", () => {
  it("prioritizes disconnected environments over saved status", () => {
    expect(scribeStatusLabel(false, null)).toBe("Disconnected");
    expect(scribeStatusLabel(true, null)).toBe("Checking");
    expect(scribeStatusLabel(true, { status: "unavailable", reason: "offline" })).toBe("Offline");
  });
  it.each([
    ["ready", "Ready"],
    ["listening", "Listening"],
    ["processing", "Processing"],
    ["mic_error", "Microphone error"],
  ] as const)("maps %s to %s", (state, label) => {
    const result = {
      status: "available",
      snapshot: {
        service: "leonidas-scribe",
        apiVersion: 1,
        state,
        sampledAt: "2026-10-11T00:00:00.000Z",
      },
    } as const;
    expect(scribeStatusLabel(true, result)).toBe(label);
    expect(scribeStatusLabel(false, result)).toBe("Disconnected");
  });
});
