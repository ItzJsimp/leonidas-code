import type { ModelBenchmarkEntry, ModelBenchmarkMetric } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildPoints, paretoFrontier, scaleValue, sortEntries } from "./benchmarkExplorer";

const metric = (
  key: string,
  kind: ModelBenchmarkMetric["kind"],
  higherIsBetter: boolean,
): ModelBenchmarkMetric => ({
  key,
  source: "benchLm",
  label: key,
  kind,
  unit: "x",
  higherIsBetter,
});
const score = metric("score", "score", true);
const price = metric("price", "price", false);

const entry = (name: string, values: Record<string, number>): ModelBenchmarkEntry => ({
  source: "benchLm",
  sourceModelKey: name,
  name,
  values,
});

describe("buildPoints", () => {
  it("keeps only entries measured on both axes and drops non-positive log values", () => {
    const points = buildPoints(
      [
        entry("a", { score: 80, price: 2 }),
        entry("b", { score: 70 }),
        entry("c", { score: 60, price: 0 }),
      ],
      price,
      score,
    );
    expect(points.map((point) => point.entry.name)).toEqual(["a"]);
  });
});

describe("paretoFrontier", () => {
  it("keeps points that are better than every cheaper point", () => {
    const points = buildPoints(
      [
        entry("cheap", { score: 50, price: 1 }),
        entry("dominated", { score: 40, price: 2 }),
        entry("strong", { score: 90, price: 5 }),
        entry("pricey", { score: 85, price: 9 }),
      ],
      price,
      score,
    );
    expect(paretoFrontier(points, price, score).map((point) => point.entry.name)).toEqual([
      "cheap",
      "strong",
    ]);
  });
});

describe("scaleValue", () => {
  it("spaces log axes evenly per order of magnitude", () => {
    expect(scaleValue(10, 1, 100, true)).toBeCloseTo(0.5);
    expect(scaleValue(50, 0, 100, false)).toBe(0.5);
  });
});

describe("sortEntries", () => {
  it("sorts on a metric and leaves unmeasured entries last", () => {
    const sorted = sortEntries(
      [entry("none", {}), entry("low", { score: 1 }), entry("high", { score: 9 })],
      { key: "score", direction: "desc" },
    );
    expect(sorted.map((row) => row.name)).toEqual(["high", "low", "none"]);
  });
});
