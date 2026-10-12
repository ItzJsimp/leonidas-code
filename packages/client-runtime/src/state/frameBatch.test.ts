import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import {
  batchStreamByFrame,
  browserFrameScheduler,
  createFrameBatch,
  HIDDEN_DOCUMENT_FLUSH_MS,
  type FrameScheduler,
} from "./frameBatch.ts";

type Snapshot = {
  readonly status: "live" | "synchronizing";
  readonly items: ReadonlyArray<string>;
};

// Frames run only when the test asks. Cancelled requests never run.
function manualScheduler() {
  let requests: Array<{ readonly flush: () => void }> = [];
  let count = 0;
  const schedule: FrameScheduler = (flush) => {
    count += 1;
    const request = { flush };
    requests.push(request);
    return () => {
      requests = requests.filter((candidate) => candidate !== request);
    };
  };
  return {
    schedule,
    get requestCount() {
      return count;
    },
    runFrame() {
      const due = requests;
      requests = [];
      for (const request of due) request.flush();
    },
  };
}

const isStatusBoundary = (previous: Snapshot, next: Snapshot) => previous.status !== next.status;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createFrameBatch", () => {
  it("emits once per frame with every chunk applied in order", () => {
    const frames = manualScheduler();
    const emitted: Array<ReadonlyArray<string>> = [];
    const batch = createFrameBatch<Snapshot>({
      emit: (value) => emitted.push(value.items),
      isBoundary: isStatusBoundary,
      schedule: frames.schedule,
    });

    batch.push({ status: "live", items: ["a"] });
    batch.push({ status: "live", items: ["a", "b"] });
    batch.push({ status: "live", items: ["a", "b", "c"] });

    expect(emitted).toEqual([["a"]]);
    expect(frames.requestCount).toBe(1);

    frames.runFrame();

    expect(emitted).toEqual([["a"], ["a", "b", "c"]]);
  });

  it("emits boundary values immediately and drops the superseded pending value", () => {
    const frames = manualScheduler();
    const emitted: Array<string> = [];
    const batch = createFrameBatch<Snapshot>({
      emit: (value) => emitted.push(value.status),
      isBoundary: isStatusBoundary,
      schedule: frames.schedule,
    });

    batch.push({ status: "live", items: [] });
    batch.push({ status: "live", items: ["stale"] });
    batch.push({ status: "synchronizing", items: ["stale"] });
    frames.runFrame();

    expect(emitted).toEqual(["live", "synchronizing"]);
  });

  it("flush emits the pending value now", () => {
    const frames = manualScheduler();
    const emitted: Array<number> = [];
    const batch = createFrameBatch<number>({
      emit: (value) => emitted.push(value),
      isBoundary: () => false,
      schedule: frames.schedule,
    });

    batch.push(1);
    batch.push(2);
    batch.flush();
    frames.runFrame();

    expect(emitted).toEqual([1, 2]);
  });

  it("dispose drops the pending value and cancels its frame", () => {
    const frames = manualScheduler();
    const emitted: Array<number> = [];
    const batch = createFrameBatch<number>({
      emit: (value) => emitted.push(value),
      isBoundary: () => false,
      schedule: frames.schedule,
    });

    batch.push(1);
    batch.push(2);
    batch.dispose();
    frames.runFrame();

    expect(emitted).toEqual([1]);
  });
});

describe("batchStreamByFrame", () => {
  it("keeps boundary values and flushes the latest value at the end of the stream", async () => {
    const frames = manualScheduler();
    const source = Stream.fromIterable<Snapshot>([
      { status: "live", items: ["a"] },
      { status: "live", items: ["a", "b"] },
      { status: "synchronizing", items: ["a", "b"] },
      { status: "live", items: ["a", "b", "c"] },
    ]);

    const emitted = await Effect.runPromise(
      Stream.runCollect(batchStreamByFrame(source, isStatusBoundary, frames.schedule)),
    );

    expect(emitted.map((value) => value.status)).toEqual(["live", "synchronizing", "live"]);
    expect(emitted[2]?.items).toEqual(["a", "b", "c"]);
  });

  it("passes the source through when no frame scheduler exists", () => {
    const source = Stream.fromIterable([1, 2, 3]);

    expect(batchStreamByFrame(source, () => false)).toBe(source);
  });
});

describe("browserFrameScheduler", () => {
  it("is unavailable without requestAnimationFrame", () => {
    expect(browserFrameScheduler()).toBeUndefined();
  });

  it("waits for the next animation frame in a visible document", () => {
    const requestFrame = vi.fn((_callback: FrameRequestCallback) => 7);
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    vi.stubGlobal("document", { visibilityState: "visible" });
    const schedule = browserFrameScheduler();
    const flush = vi.fn();

    const cancel = schedule!(flush);
    expect(flush).not.toHaveBeenCalled();
    requestFrame.mock.calls[0]![0](0);
    expect(flush).toHaveBeenCalledTimes(1);

    cancel();
    expect(cancelFrame).toHaveBeenCalledWith(7);
  });

  it("flushes on a timer when the document is hidden", () => {
    vi.useFakeTimers();
    const requestFrame = vi.fn((_callback: FrameRequestCallback) => 1);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("document", { visibilityState: "hidden" });
    const schedule = browserFrameScheduler();
    const flush = vi.fn();

    schedule!(flush);
    vi.advanceTimersByTime(HIDDEN_DOCUMENT_FLUSH_MS - 1);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
