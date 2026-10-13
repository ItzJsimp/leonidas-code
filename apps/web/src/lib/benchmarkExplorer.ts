import type { ModelBenchmarkEntry, ModelBenchmarkMetric } from "@t3tools/contracts";

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
    const left = a.values[sort.key];
    const right = b.values[sort.key];
    if (left === undefined && right === undefined) return a.name.localeCompare(b.name);
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return direction * (left - right) || a.name.localeCompare(b.name);
  });
}
