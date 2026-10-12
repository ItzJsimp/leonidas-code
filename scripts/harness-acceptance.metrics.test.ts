import { describe, expect, it } from "vite-plus/test";
import { summarize, timingVerdict } from "./harness-acceptance.metrics.ts";

describe("acceptance measurement integrity", () => {
  it("reports nearest-rank median and p95 without mutating raw samples", () => {
    const samples = [20, ...Array.from({ length: 19 }, (_, index) => index + 1)];
    expect(summarize(samples)).toEqual({ count: 20, medianMs: 10, p95Ms: 19, minMs: 1, maxMs: 20 });
    expect(samples[0]).toBe(20);
  });
  it("rejects empty, negative and non-finite measurements", () => {
    for (const samples of [[], [-1], [NaN], [Infinity]]) {
      expect(() => summarize(samples)).toThrow();
    }
  });
  it("fails semantic mismatch regardless of speed and distinguishes timing noise", () => {
    expect(timingVerdict([1], [0], false)).toBe("fail-output");
    expect(timingVerdict([1], [1.1], true)).toBe("within-noise");
    expect(timingVerdict([1], [1.3], true)).toBe("regression");
    expect(timingVerdict([1], [0.8], true)).toBe("improved");
  });
  it("flags a tail-only regression and tolerates sub-resolution differences", () => {
    expect(timingVerdict(Array(20).fill(1), [...Array(18).fill(1), 3, 3], true)).toBe("regression");
    expect(timingVerdict([0.001], [0.04], true)).toBe("within-noise");
  });
});
