import * as Schema from "effect/Schema";

import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Public benchmark publishers the server reads. BenchLM republishes results
 * from Artificial Analysis, Vals, LiveBench, Arena and others with credit.
 * Each source keeps its own scale: scores are never blended into one number.
 */
export const ModelBenchmarkSourceId = Schema.Literals(["benchLm"]);
export type ModelBenchmarkSourceId = typeof ModelBenchmarkSourceId.Type;

/** `unavailable` means the last fetch failed and no earlier copy exists. */
export const ModelBenchmarkSourceStatus = Schema.Struct({
  source: ModelBenchmarkSourceId,
  state: Schema.Literals(["ready", "unavailable"]),
  fetchedAt: Schema.optional(IsoDateTime),
  /** Credit line the source requires wherever its numbers are shown. */
  attribution: TrimmedNonEmptyString,
  url: TrimmedNonEmptyString,
});
export type ModelBenchmarkSourceStatus = typeof ModelBenchmarkSourceStatus.Type;

/**
 * One number a source publishes per model. `kind` picks the chart chip (Score,
 * Cost, Speed); `higherIsBetter` decides the ranking direction.
 */
export const ModelBenchmarkMetric = Schema.Struct({
  key: TrimmedNonEmptyString,
  source: ModelBenchmarkSourceId,
  label: TrimmedNonEmptyString,
  kind: Schema.Literals(["score", "price", "speed", "latency"]),
  unit: Schema.String,
  higherIsBetter: Schema.Boolean,
  /** Grouping such as "coding" or "reasoning", when the source has one. */
  category: Schema.optional(TrimmedNonEmptyString),
});
export type ModelBenchmarkMetric = typeof ModelBenchmarkMetric.Type;

/** A source's record for one model (and effort, when the source splits by it). */
export const ModelBenchmarkEntry = Schema.Struct({
  source: ModelBenchmarkSourceId,
  sourceModelKey: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  creator: Schema.optional(TrimmedNonEmptyString),
  effort: Schema.optional(TrimmedNonEmptyString),
  /** Metric key to value; a metric the source did not measure is absent. */
  values: Schema.Record(Schema.String, Schema.Number),
  url: Schema.optional(TrimmedNonEmptyString),
});
export type ModelBenchmarkEntry = typeof ModelBenchmarkEntry.Type;

/** A model the user can run, as the provider names it. */
export const ModelBenchmarkQuery = Schema.Struct({
  modelId: TrimmedNonEmptyString,
  displayName: Schema.optional(TrimmedNonEmptyString),
  effort: Schema.optional(TrimmedNonEmptyString),
});
export type ModelBenchmarkQuery = typeof ModelBenchmarkQuery.Type;

export const ModelBenchmarkMatch = Schema.Struct({
  entry: ModelBenchmarkEntry,
  /**
   * False when the query asked for an effort the source never measured and
   * the entry is the model's default run instead.
   */
  effortMeasured: Schema.Boolean,
});
export type ModelBenchmarkMatch = typeof ModelBenchmarkMatch.Type;

/** At most one match per source; no matches means the model is unknown to every source. */
export const ModelBenchmarkRow = Schema.Struct({
  query: ModelBenchmarkQuery,
  matches: Schema.Array(ModelBenchmarkMatch),
});
export type ModelBenchmarkRow = typeof ModelBenchmarkRow.Type;

export const ModelBenchmarkReport = Schema.Struct({
  sources: Schema.Array(ModelBenchmarkSourceStatus),
  /** Only metrics at least one row has a value for. */
  metrics: Schema.Array(ModelBenchmarkMetric),
  rows: Schema.Array(ModelBenchmarkRow),
});
export type ModelBenchmarkReport = typeof ModelBenchmarkReport.Type;
