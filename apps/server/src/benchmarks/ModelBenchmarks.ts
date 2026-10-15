/**
 * ModelBenchmarks - public benchmark results for the models a user can run.
 *
 * Reads BenchLM's free static files, which need no key. They are fetched at
 * most once an hour, on demand. A failed refresh keeps serving the last good
 * copy, marked stale, and the next download waits five minutes.
 *
 * @module ModelBenchmarks
 */
import { indexBenchmarkEntries } from "@t3tools/shared/modelBenchmarkMatch";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import type {
  ModelBenchmarkCatalog,
  ModelBenchmarkQuery,
  ModelBenchmarkReport,
} from "@t3tools/contracts";

import {
  matchBenchmarks,
  parseBenchLm,
  type ParsedBenchmarkSource,
} from "./ModelBenchmarkSources.ts";

const CACHE_TTL_MS = 60 * 60 * 1000;
const FAILED_REFRESH_RETRY_MS = 5 * 60 * 1000;
const BENCHLM_DATA_URL = "https://benchlm.ai/data";

export class ModelBenchmarks extends Context.Service<
  ModelBenchmarks,
  {
    /** Rows in query order; refreshes the data first when it is older than an hour. */
    readonly report: (
      queries: ReadonlyArray<ModelBenchmarkQuery>,
    ) => Effect.Effect<ModelBenchmarkReport>;
    /** Every model and metric the source publishes, for the benchmark explorer. */
    readonly catalog: Effect.Effect<ModelBenchmarkCatalog>;
  }
>()("t3/benchmarks/ModelBenchmarks") {}

const make = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
  let cached: { readonly fetchedAtMs: number; readonly parsed: ParsedBenchmarkSource } | undefined;
  let failedAtMs: number | undefined;
  // Two panels opening at once share one download instead of racing.
  const refreshLock = yield* Semaphore.make(1);

  const getJson = (file: string) =>
    client.execute(HttpClientRequest.get(`${BENCHLM_DATA_URL}/${file}.json`)).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.json),
      Effect.timeout("20 seconds"),
    );

  const refresh = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    if (cached && now - cached.fetchedAtMs < CACHE_TTL_MS) return;
    if (failedAtMs !== undefined && now - failedAtMs < FAILED_REFRESH_RETRY_MS) return;
    yield* Effect.all(
      {
        models: getJson("models"),
        pricing: getJson("pricing"),
        speed: getJson("speed"),
        benchmarks: getJson("benchmarks"),
      },
      { concurrency: "unbounded" },
    ).pipe(
      Effect.map(parseBenchLm),
      Effect.tap((parsed) =>
        Effect.sync(() => {
          cached = { fetchedAtMs: now, parsed };
          failedAtMs = undefined;
        }),
      ),
      Effect.catch((cause) =>
        Effect.sync(() => {
          failedAtMs = now;
        }).pipe(
          Effect.andThen(Effect.logWarning("BenchLM refresh failed")),
          Effect.annotateLogs({ cause: String(cause) }),
        ),
      ),
    );
  });

  const sourceStatus = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const state = !cached
      ? ("unavailable" as const)
      : failedAtMs !== undefined && now - cached.fetchedAtMs >= CACHE_TTL_MS
        ? ("stale" as const)
        : ("ready" as const);
    return {
      source: "benchLm" as const,
      state,
      ...(cached ? { fetchedAt: DateTime.formatIso(DateTime.makeUnsafe(cached.fetchedAtMs)) } : {}),
      ...(failedAtMs !== undefined
        ? { refreshFailedAt: DateTime.formatIso(DateTime.makeUnsafe(failedAtMs)) }
        : {}),
      attribution: "Data from BenchLM.ai",
      url: "https://benchlm.ai",
    };
  });

  const catalog: ModelBenchmarks["Service"]["catalog"] = Effect.gen(function* () {
    yield* refreshLock.withPermits(1)(refresh);
    return {
      sources: [yield* sourceStatus],
      metrics: cached?.parsed.metrics ?? [],
      entries: cached?.parsed.entries ?? [],
    };
  });

  const report: ModelBenchmarks["Service"]["report"] = Effect.fn("ModelBenchmarks.report")(
    function* (queries) {
      yield* refreshLock.withPermits(1)(refresh);
      const index = indexBenchmarkEntries(cached?.parsed.entries ?? []);
      const rows = queries.map((query) => ({ query, matches: matchBenchmarks(query, index) }));
      const usedKeys = new Set(
        rows.flatMap((row) => row.matches.flatMap((match) => Object.keys(match.entry.values))),
      );
      return {
        sources: [yield* sourceStatus],
        metrics: (cached?.parsed.metrics ?? []).filter((metric) => usedKeys.has(metric.key)),
        rows,
      };
    },
  );

  return ModelBenchmarks.of({ report, catalog });
});

export const layer = Layer.effect(ModelBenchmarks, make);
