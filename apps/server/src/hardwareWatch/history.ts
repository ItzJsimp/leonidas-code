// @effect-diagnostics globalDate:off globalDateInEffect:off preferSchemaOverJson:off
/**
 * Tiered history on disk: one NDJSON file of minute points per UTC day (kept 7 days) and one of
 * hour points per UTC month (kept about 90 days). Whole-file pruning means no rewrites, and an
 * investigating agent can read the files directly. Files live beside the database rather than in
 * it so upstream migrations stay untouched.
 */
import type {
  HardwareHistory,
  HardwareHistoryPoint,
  HardwareHistoryRange,
} from "@t3tools/contracts";
import { mergePoints, rollup, type HardwareMetrics } from "@t3tools/shared/hardwareWatch";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RAW_RETENTION_MS = HOUR_MS;
const MINUTE_RETENTION_MS = 7 * DAY_MS;
const HOUR_RETENTION_MS = 90 * DAY_MS;

const day = (at: number) => new Date(at).toISOString().slice(0, 10);
const month = (at: number) => new Date(at).toISOString().slice(0, 7);
const minuteFile = (at: number) => `minutes-${day(at)}.ndjson`;
const hourFile = (at: number) => `hours-${month(at)}.ndjson`;

export function parsePoints(text: string): HardwareHistoryPoint[] {
  const points: HardwareHistoryPoint[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const point = JSON.parse(line) as HardwareHistoryPoint;
      if (typeof point.at === "number" && point.avg && point.max) points.push(point);
    } catch {
      // A torn last line after a crash loses one minute, not the file.
    }
  }
  return points;
}

/** Buckets points into `bucketMs` windows so a chart gets a bounded number of points. */
export function downsample(
  points: ReadonlyArray<HardwareHistoryPoint>,
  bucketMs: number,
): HardwareHistoryPoint[] {
  const buckets = new Map<number, HardwareHistoryPoint[]>();
  for (const point of points) {
    const at = Math.floor(point.at / bucketMs) * bucketMs;
    const bucket = buckets.get(at);
    if (bucket) bucket.push(point);
    else buckets.set(at, [point]);
  }
  return [...buckets.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([at, bucket]) => (bucket.length === 1 ? { ...bucket[0]!, at } : mergePoints(at, bucket)));
}

interface RawSample {
  readonly at: number;
  readonly metrics: HardwareMetrics;
}

/**
 * In memory: raw samples for the last hour, minute points for the last day, hour points for 90
 * days. Older minute points are read from disk only for the 7-day view.
 */
export const makeHistory = Effect.fn("hardwareWatch.makeHistory")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(dir, { recursive: true });

  const readFile = (name: string) =>
    fs.readFileString(path.join(dir, name)).pipe(
      Effect.map(parsePoints),
      Effect.orElseSucceed((): HardwareHistoryPoint[] => []),
    );
  const append = (name: string, point: HardwareHistoryPoint) =>
    fs
      .writeFileString(path.join(dir, name), `${JSON.stringify(point)}\n`, { flag: "a" })
      .pipe(Effect.ignore);

  const now = Date.now();
  let raw: RawSample[] = [];
  let minutes: HardwareHistoryPoint[] = [
    ...(yield* readFile(minuteFile(now - DAY_MS))),
    ...(yield* readFile(minuteFile(now))),
  ].filter((point) => point.at >= now - DAY_MS);
  let hours: HardwareHistoryPoint[] = [];
  for (let offset = 3; offset >= 0; offset--) {
    const date = new Date(now);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - offset);
    hours.push(...(yield* readFile(hourFile(date.getTime()))));
  }
  hours = hours.filter((point) => point.at >= now - HOUR_RETENTION_MS);
  let minuteBucket = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  let hourBucket = Math.floor(now / HOUR_MS) * HOUR_MS;
  let pending: HardwareMetrics[] = [];

  const prune = Effect.gen(function* () {
    const names = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed((): string[] => []));
    const at = Date.now();
    for (const name of names) {
      const minute = /^minutes-(\d{4}-\d{2}-\d{2})\.ndjson$/.exec(name)?.[1];
      const hour = /^hours-(\d{4}-\d{2})\.ndjson$/.exec(name)?.[1];
      const stale =
        (minute !== undefined && Date.parse(minute) < at - MINUTE_RETENTION_MS - DAY_MS) ||
        (hour !== undefined && Date.parse(`${hour}-01`) < at - HOUR_RETENTION_MS - 31 * DAY_MS);
      if (stale) yield* fs.remove(path.join(dir, name)).pipe(Effect.ignore);
    }
  });

  /** Records one sample; returns true when an hour point closed (drift checks run then). */
  const record = (at: number, metrics: HardwareMetrics) =>
    Effect.gen(function* () {
      raw.push({ at, metrics });
      if (raw[0] && raw[0].at < at - RAW_RETENTION_MS)
        raw = raw.filter((sample) => sample.at >= at - RAW_RETENTION_MS);
      let hourClosed = false;
      const bucket = Math.floor(at / MINUTE_MS) * MINUTE_MS;
      if (bucket !== minuteBucket) {
        if (pending.length > 0) {
          const point = rollup(minuteBucket, pending);
          minutes.push(point);
          yield* append(minuteFile(point.at), point);
        }
        pending = [];
        minuteBucket = bucket;
        minutes = minutes.filter((point) => point.at >= at - DAY_MS);
        const hour = Math.floor(at / HOUR_MS) * HOUR_MS;
        if (hour !== hourBucket) {
          const closing = minutes.filter((point) => point.at >= hourBucket && point.at < hour);
          if (closing.length > 0) {
            const point = mergePoints(hourBucket, closing);
            hours.push(point);
            hours = hours.filter((entry) => entry.at >= at - HOUR_RETENTION_MS);
            yield* append(hourFile(point.at), point);
            hourClosed = true;
          }
          hourBucket = hour;
          yield* prune;
        }
      }
      pending.push(metrics);
      return hourClosed;
    });

  const read = (range: HardwareHistoryRange) =>
    Effect.gen(function* () {
      const at = Date.now();
      switch (range) {
        case "1h": {
          // About 360 points: ten-second buckets of raw samples.
          const points = raw.map((sample) => rollup(sample.at, [sample.metrics]));
          return { range, resolutionMs: 10_000, points: downsample(points, 10_000) };
        }
        case "24h":
          return { range, resolutionMs: 5 * MINUTE_MS, points: downsample(minutes, 5 * MINUTE_MS) };
        case "7d": {
          const files: HardwareHistoryPoint[] = [];
          for (let offset = 7; offset >= 0; offset--)
            files.push(...(yield* readFile(minuteFile(at - offset * DAY_MS))));
          const recent = files.filter((point) => point.at >= at - 7 * DAY_MS);
          return {
            range,
            resolutionMs: 30 * MINUTE_MS,
            points: downsample(recent, 30 * MINUTE_MS),
          };
        }
        case "90d":
          return { range, resolutionMs: 6 * HOUR_MS, points: downsample(hours, 6 * HOUR_MS) };
      }
    }) satisfies Effect.Effect<HardwareHistory>;

  return {
    record,
    read,
    hours: () => hours as ReadonlyArray<HardwareHistoryPoint>,
    oldestAt: () => hours[0]?.at ?? minutes[0]?.at ?? raw[0]?.at ?? null,
  };
});

export type HardwareHistoryStore = Effect.Success<ReturnType<typeof makeHistory>>;
