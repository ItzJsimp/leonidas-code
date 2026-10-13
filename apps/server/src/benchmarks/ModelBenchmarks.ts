/**
 * ModelBenchmarks - public benchmark results for the models a user can run.
 *
 * Reads BenchLM's free static files, which need no key. They are fetched at
 * most once an hour, on demand, and a failed refresh keeps serving the last
 * good copy.
 *
 * @module ModelBenchmarks
 */
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import type { ModelBenchmarkQuery, ModelBenchmarkReport } from "@t3tools/contracts";

import {
  matchBenchmarks,
  parseBenchLm,
  type ParsedBenchmarkSource,
} from "./ModelBenchmarkSources.ts";

const CACHE_TTL_MS = 60 * 60 * 1000;
const BENCHLM_DATA_URL = "https://benchlm.ai/data";

export class ModelBenchmarks extends Context.Service<
  ModelBenchmarks,
  {
    /** Rows in query order; refreshes the data first when it is older than an hour. */
    readonly report: (
      queries: ReadonlyArray<ModelBenchmarkQuery>,
    ) => Effect.Effect<ModelBenchmarkReport>;
  }
>()("t3/benchmarks/ModelBenchmarks") {}

const make = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
  let cached: { readonly fetchedAtMs: number; readonly parsed: ParsedBenchmarkSource } | undefined;
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
      Effect.tap((parsed) => Effect.sync(() => (cached = { fetchedAtMs: now, parsed }))),
      Effect.catch((cause) =>
        Effect.logWarning("BenchLM refresh failed").pipe(
          Effect.annotateLogs({ cause: String(cause) }),
        ),
      ),
    );
  });

  const report: ModelBenchmarks["Service"]["report"] = Effect.fn("ModelBenchmarks.report")(
    function* (queries) {
      yield* refreshLock.withPermits(1)(refresh);
      const entries = cached?.parsed.entries ?? [];
      const rows = queries.map((query) => ({ query, matches: matchBenchmarks(query, entries) }));
      const usedKeys = new Set(
        rows.flatMap((row) => row.matches.flatMap((match) => Object.keys(match.entry.values))),
      );
      return {
        sources: [
          {
            source: "benchLm" as const,
            state: cached ? ("ready" as const) : ("unavailable" as const),
            ...(cached
              ? { fetchedAt: DateTime.formatIso(DateTime.makeUnsafe(cached.fetchedAtMs)) }
              : {}),
            attribution: "Data from BenchLM.ai",
            url: "https://benchlm.ai",
          },
        ],
        metrics: (cached?.parsed.metrics ?? []).filter((metric) => usedKeys.has(metric.key)),
        rows,
      };
    },
  );

  return ModelBenchmarks.of({ report });
});

export const layer = Layer.effect(ModelBenchmarks, make);
