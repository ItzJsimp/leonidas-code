import { describe, expect, it } from "vite-plus/test";

import type { ImageItemStatus } from "@t3tools/contracts";

import {
  ImageQueue,
  MAX_RANDOM_SEED,
  expandVariations,
  pickRandomSeed,
  shouldFreeMemory,
} from "./imageQueue.ts";

describe("expandVariations", () => {
  it("makes seed + i for each variation", () => {
    expect(expandVariations({ modelIds: ["a"], seed: 100, count: 3 })).toEqual([
      { modelId: "a", seed: 100 },
      { modelId: "a", seed: 101 },
      { modelId: "a", seed: 102 },
    ]);
  });

  it("orders model by model so the model changes as seldom as possible", () => {
    const planned = expandVariations({ modelIds: ["a", "b"], seed: 10, count: 2 });
    expect(planned.map((p) => `${p.modelId}${String(p.seed)}`)).toEqual([
      "a10",
      "a11",
      "b10",
      "b11",
    ]);
  });

  it("limits the count to 1 through 12 and drops repeated models", () => {
    expect(expandVariations({ modelIds: ["a"], seed: 0, count: 99 })).toHaveLength(12);
    expect(expandVariations({ modelIds: ["a"], seed: 0, count: 0 })).toHaveLength(1);
    expect(expandVariations({ modelIds: ["a", "a"], seed: 0, count: 2 })).toHaveLength(2);
  });
});

describe("pickRandomSeed", () => {
  it("stays inside the safe range", () => {
    expect(pickRandomSeed(() => 0)).toBe(0);
    expect(pickRandomSeed(() => 0.999999999)).toBeLessThanOrEqual(MAX_RANDOM_SEED);
  });
});

describe("shouldFreeMemory", () => {
  it("frees before the first image and when the model changes", () => {
    expect(shouldFreeMemory(null, "a")).toBe(true);
    expect(shouldFreeMemory("a", "b")).toBe(true);
  });

  it("does not free while the model stays the same", () => {
    expect(shouldFreeMemory("a", "a")).toBe(false);
  });
});

describe("ImageQueue", () => {
  const entry = (name: string) => ({ name, status: "waiting" as ImageItemStatus });
  type TestEntry = ReturnType<typeof entry>;

  it("hands out waiting entries first in, first out, one at a time", () => {
    const queue = new ImageQueue<TestEntry>();
    queue.enqueue([entry("1"), entry("2")]);
    queue.enqueue([entry("3")]);
    const first = queue.claimNext();
    expect(first?.name).toBe("1");
    expect(first?.status).toBe("running");
    expect(queue.claimNext()).toBeUndefined();
    first!.status = "done";
    expect(queue.claimNext()?.name).toBe("2");
  });

  it("cancels only waiting entries", () => {
    const queue = new ImageQueue<TestEntry>();
    queue.enqueue([entry("1"), entry("2"), entry("3")]);
    const running = queue.claimNext()!;
    const cancelled = queue.cancelWaiting();
    expect(cancelled.map((e) => e.name)).toEqual(["2", "3"]);
    expect(running.status).toBe("running");
    expect(queue.claimNext()).toBeUndefined();
  });

  it("trims old finished entries and keeps waiting and running ones", () => {
    const queue = new ImageQueue<TestEntry>();
    const finished = [entry("1"), entry("2"), entry("3")];
    for (const item of finished) item.status = "done";
    queue.enqueue([...finished, entry("4"), entry("5")]);
    queue.claimNext();
    queue.trim(3);
    expect(queue.items.map((e) => e.name)).toEqual(["3", "4", "5"]);
  });
});
