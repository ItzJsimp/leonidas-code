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
import * as Option from "effect/Option";
import * as Semaphore from "effect/Semaphore";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import type {
  ModelBenchmarkCatalog,
  ModelBenchmarkQuery,
  ModelBenchmarkReport,
} from "@t3tools/contracts";

import { ServerSettingsService } from "../serverSettings.ts";
import {
  matchBenchmarks,
  parseArtificialAnalysis,
  parseBenchLm,
  type ParsedBenchmarkSource,
} from "./ModelBenchmarkSources.ts";

const CACHE_TTL_MS = 60 * 60 * 1000;
const FAILED_REFRESH_RETRY_MS = 5 * 60 * 1000;
const BENCHLM_DATA_URL = "https://benchlm.ai/data";
const AA_MODELS_URL = "https://artificialanalysis.ai/api/v2/language/models/free";
/** A guard against a runaway `has_more`; the list is a few hundred rows. */
const AA_MAX_PAGES = 12;

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
  // Optional so the service still builds where no settings exist (tests, tools).
  const settings = yield* Effect.serviceOption(ServerSettingsService);
  const readAaKey = Option.isSome(settings)
    ? settings.value.getSettings.pipe(
        Effect.map((value) => value.artificialAnalysisApiKey.trim()),
        Effect.orElseSucceed(() => ""),
      )
    : Effect.succeed("");
  let aaCached:
    | { readonly fetchedAtMs: number; readonly key: string; readonly parsed: ParsedBenchmarkSource }
    | undefined;
  let aaFailedAtMs: number | undefined;
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

  const getAaPage = (key: string, page: number) =>
    client
      .execute(
        HttpClientRequest.get(AA_MODELS_URL).pipe(
          HttpClientRequest.setUrlParam("page", String(page)),
          HttpClientRequest.setHeader("x-api-key", key),
        ),
      )
      .pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) => response.json),
        Effect.timeout("20 seconds"),
      );

  const refreshAa = Effect.gen(function* () {
    const key = yield* readAaKey;
    if (key.length === 0) {
      aaCached = undefined;
      aaFailedAtMs = undefined;
      return;
    }
    const now = yield* Clock.currentTimeMillis;
    if (aaCached && aaCached.key !== key) {
      aaCached = undefined;
      aaFailedAtMs = undefined;
    }
    if (aaCached && now - aaCached.fetchedAtMs < CACHE_TTL_MS) return;
    if (aaFailedAtMs !== undefined && now - aaFailedAtMs < FAILED_REFRESH_RETRY_MS) return;
    const pages: unknown[] = [];
    for (let page = 1; page <= AA_MAX_PAGES; page++) {
      const body = yield* getAaPage(key, page);
      pages.push(body);
      const pagination = (body as { pagination?: { has_more?: unknown } } | null)?.pagination;
      if (pagination?.has_more !== true) break;
    }
    aaCached = { fetchedAtMs: now, key, parsed: parseArtificialAnalysis(pages) };
    aaFailedAtMs = undefined;
  }).pipe(
    Effect.catch((cause) =>
      Clock.currentTimeMillis.pipe(
        Effect.tap((now) =>
          Effect.sync(() => {
            aaFailedAtMs = now;
          }),
        ),
        Effect.andThen(Effect.logWarning("Artificial Analysis refresh failed")),
        Effect.annotateLogs({ cause: String(cause) }),
      ),
    ),
  );

  const aaStatus = Effect.gen(function* () {
    const key = yield* readAaKey;
    if (key.length === 0) return [];
    const now = yield* Clock.currentTimeMillis;
    const state = !aaCached
      ? ("unavailable" as const)
      : aaFailedAtMs !== undefined && now - aaCached.fetchedAtMs >= CACHE_TTL_MS
        ? ("stale" as const)
        : ("ready" as const);
    return [
      {
        source: "artificialAnalysis" as const,
        state,
        ...(aaCached
          ? { fetchedAt: DateTime.formatIso(DateTime.makeUnsafe(aaCached.fetchedAtMs)) }
          : {}),
        ...(aaFailedAtMs !== undefined
          ? { refreshFailedAt: DateTime.formatIso(DateTime.makeUnsafe(aaFailedAtMs)) }
          : {}),
        attribution: "Data from Artificial Analysis (artificialanalysis.ai)",
        url: "https://artificialanalysis.ai",
      },
    ];
  });

  const allEntries = () => [...(cached?.parsed.entries ?? []), ...(aaCached?.parsed.entries ?? [])];
  const allMetrics = () => [...(cached?.parsed.metrics ?? []), ...(aaCached?.parsed.metrics ?? [])];

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
    yield* refreshLock.withPermits(1)(Effect.andThen(refresh, refreshAa));
    return {
      sources: [yield* sourceStatus, ...(yield* aaStatus)],
      metrics: allMetrics(),
      entries: allEntries(),
    };
  });

  const report: ModelBenchmarks["Service"]["report"] = Effect.fn("ModelBenchmarks.report")(
    function* (queries) {
      yield* refreshLock.withPermits(1)(Effect.andThen(refresh, refreshAa));
      const index = indexBenchmarkEntries(allEntries());
      const rows = queries.map((query) => ({ query, matches: matchBenchmarks(query, index) }));
      const usedKeys = new Set(
        rows.flatMap((row) => row.matches.flatMap((match) => Object.keys(match.entry.values))),
      );
      return {
        sources: [yield* sourceStatus, ...(yield* aaStatus)],
        metrics: allMetrics().filter((metric) => usedKeys.has(metric.key)),
        rows,
      };
    },
  );

  return ModelBenchmarks.of({ report, catalog });
});

export const layer = Layer.effect(ModelBenchmarks, make);
