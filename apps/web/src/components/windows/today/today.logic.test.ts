import { describe, expect, it } from "vite-plus/test";

import { prioritySummary } from "./today.logic";

const item = (title: string, done: boolean) => ({ title, detail: "", done, taskId: null });

describe("prioritySummary", () => {
  it("counts done of total and gives the ring fraction", () => {
    const summary = prioritySummary([item("a", true), item("b", false), item("c", true)]);
    expect(summary.done).toBe(2);
    expect(summary.total).toBe(3);
    expect(summary.label).toBe("2 of 3 done");
    expect(summary.fraction).toBeCloseTo(0.6667, 3);
  });

  it("says no priorities for 0 of 0, never NaN", () => {
    const summary = prioritySummary([]);
    expect(summary.label).toBe("No priorities today");
    expect(summary.fraction).toBe(0);
  });

  it("treats a missing brief like no priorities", () => {
    expect(prioritySummary(null).label).toBe("No priorities today");
  });

  it("says all done when every priority is done", () => {
    const summary = prioritySummary([item("a", true), item("b", true)]);
    expect(summary.label).toBe("All 2 done");
    expect(summary.fraction).toBe(1);
  });
});
