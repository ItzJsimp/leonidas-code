import type { ModelBenchmarkEntry, ModelBenchmarkMetric } from "@t3tools/contracts";
import { indexBenchmarkEntries, matchBenchmarks } from "@t3tools/shared/modelBenchmarkMatch";

import type { BenchmarkCandidate } from "./modelBenchmarks";

/** One model plotted on two metrics. */
export interface ExplorerPoint {
  readonly entry: ModelBenchmarkEntry;
  readonly x: number;
  readonly y: number;
}

/** Price and latency span orders of magnitude, so they read on a log axis like Artificial Analysis. */
export const isLogMetric = (metric: ModelBenchmarkMetric) =>
  metric.kind === "price" || metric.kind === "latency";

/** Entries that have a number for both metrics (and a positive x on a log axis). */
export function buildPoints(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  xMetric: ModelBenchmarkMetric,
  yMetric: ModelBenchmarkMetric,
): ReadonlyArray<ExplorerPoint> {
  const points: ExplorerPoint[] = [];
  for (const entry of entries) {
    const x = entry.values[xMetric.key];
    const y = entry.values[yMetric.key];
    if (x === undefined || y === undefined) continue;
    if (isLogMetric(xMetric) && x <= 0) continue;
    points.push({ entry, x, y });
  }
  return points;
}

/**
 * Points no other point beats on both axes, ordered along x: the dotted
 * "best you can get for this price or speed" line.
 */
export function paretoFrontier(
  points: ReadonlyArray<ExplorerPoint>,
  xMetric: ModelBenchmarkMetric,
  yMetric: ModelBenchmarkMetric,
): ReadonlyArray<ExplorerPoint> {
  const xSign = xMetric.higherIsBetter ? -1 : 1;
  const ySign = yMetric.higherIsBetter ? -1 : 1;
  const sorted = points.toSorted((a, b) => xSign * (a.x - b.x) || ySign * (a.y - b.y));
  const frontier: ExplorerPoint[] = [];
  let best = Number.NEGATIVE_INFINITY;
  for (const point of sorted) {
    const goodness = -ySign * point.y;
    if (goodness > best) {
      best = goodness;
      frontier.push(point);
    }
  }
  return frontier;
}

/** Maps a value into 0..1 over [min, max], log-spaced when `log`. */
export function scaleValue(value: number, min: number, max: number, log: boolean): number {
  if (max === min) return 0.5;
  if (log) {
    const lo = Math.log(min);
    return (Math.log(value) - lo) / (Math.log(max) - lo);
  }
  return (value - min) / (max - min);
}

export type ExplorerSort = { readonly key: string; readonly direction: "asc" | "desc" };

/** Rows sorted on a metric key or "name"; entries without the value sink to the bottom. */
export function sortEntries(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  sort: ExplorerSort,
): ReadonlyArray<ModelBenchmarkEntry> {
  const direction = sort.direction === "asc" ? 1 : -1;
  return entries.toSorted((a, b) => {
    if (sort.key === "name") return direction * a.name.localeCompare(b.name);
    if (sort.key === "effort")
      return direction * (effortRank(a) - effortRank(b)) || a.name.localeCompare(b.name);
    const left = a.values[sort.key];
    const right = b.values[sort.key];
    if (left === undefined && right === undefined) return a.name.localeCompare(b.name);
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return direction * (left - right) || a.name.localeCompare(b.name);
  });
}

/**
 * The scores most people compare on: the source's overall number and its
 * category scores. The hundreds of individual benchmarks stay out of the picker.
 */
export const headlineScoreMetrics = (metrics: ReadonlyArray<ModelBenchmarkMetric>) =>
  metrics.filter((metric) => metric.kind === "score" && !metric.key.includes(":benchmark:"));

/** The one axis metric per kind: output price for cost, the first otherwise. */
export function defaultXMetric(
  metrics: ReadonlyArray<ModelBenchmarkMetric>,
  kind: ModelBenchmarkMetric["kind"],
): ModelBenchmarkMetric | undefined {
  const ofKind = metrics.filter((metric) => metric.kind === kind);
  return ofKind.find((metric) => metric.key.endsWith("output")) ?? ofKind[0];
}

/** The best value per metric across entries, for highlighting the leader in each column. */
export function columnBests(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  metrics: ReadonlyArray<ModelBenchmarkMetric>,
): ReadonlyMap<string, number> {
  const bests = new Map<string, number>();
  for (const metric of metrics) {
    for (const entry of entries) {
      const value = entry.values[metric.key];
      if (value === undefined) continue;
      const current = bests.get(metric.key);
      if (current === undefined || (metric.higherIsBetter ? value > current : value < current)) {
        bests.set(metric.key, value);
      }
    }
  }
  return bests;
}

const EFFORT_ORDER = ["minimal", "low", "medium", "high", "xhigh", "max"];

/** Default (unsplit) runs sort first, then efforts from lightest to heaviest. */
export const effortRank = (entry: ModelBenchmarkEntry) =>
  entry.effort === undefined ? -1 : EFFORT_ORDER.indexOf(entry.effort);

/** Efforts present in the catalog, lightest first. */
export const catalogEfforts = (entries: ReadonlyArray<ModelBenchmarkEntry>) =>
  [...new Set(entries.flatMap((entry) => (entry.effort ? [entry.effort] : [])))].toSorted(
    (a, b) => EFFORT_ORDER.indexOf(a) - EFFORT_ORDER.indexOf(b),
  );

/** "default" keeps runs the source did not split by effort. */
export const matchesEffort = (entry: ModelBenchmarkEntry, effort: string) =>
  effort === "all" || (effort === "default" ? entry.effort === undefined : entry.effort === effort);

const FALLBACK_EFFORTS: ReadonlyArray<string | undefined> = [
  undefined,
  "medium",
  "high",
  "low",
  "xhigh",
  "max",
  "minimal",
];

/**
 * Source model key to the runnable candidates it describes, matched locally
 * against the whole catalog so no provider's list is ever truncated. A
 * candidate whose effort the source measured is listed first.
 */
export function availableEntries(
  entries: ReadonlyArray<ModelBenchmarkEntry>,
  candidates: ReadonlyArray<BenchmarkCandidate>,
): ReadonlyMap<string, ReadonlyArray<BenchmarkCandidate>> {
  const index = indexBenchmarkEntries(entries);
  const byKey = new Map<
    string,
    { measured: BenchmarkCandidate[]; fallback: BenchmarkCandidate[] }
  >();
  for (const candidate of candidates) {
    for (const match of matchBenchmarks(candidate.query, index)) {
      const key = match.entry.sourceModelKey;
      const slot = byKey.get(key) ?? { measured: [], fallback: [] };
      (match.effortMeasured ? slot.measured : slot.fallback).push(candidate);
      byKey.set(key, slot);
    }
  }
  // A default run says nothing about effort; start that chat on the provider's usual setting.
  const fallbackRank = (candidate: BenchmarkCandidate) =>
    FALLBACK_EFFORTS.indexOf(candidate.query.effort?.toLowerCase());
  return new Map(
    [...byKey].map(([key, slot]) => [
      key,
      [...slot.measured, ...slot.fallback.toSorted((a, b) => fallbackRank(a) - fallbackRank(b))],
    ]),
  );
}
