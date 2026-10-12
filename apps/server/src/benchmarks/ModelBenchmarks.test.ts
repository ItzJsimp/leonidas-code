import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import { HttpClient, HttpClientResponse } from "effect/http";

import {
  canonicalModelKey,
  matchBenchmarks,
  parseBenchLm,
  splitEffort,
} from "./ModelBenchmarkSources.ts";
import * as ModelBenchmarks from "./ModelBenchmarks.ts";

// Trimmed copies of the live feeds' shapes (BenchLM schema 1.0).
const benchLmFeeds = {
  models: {
    items: [
      {
        canonicalModelKey: "claude-opus-5-5",
        model: "Claude Opus 5.5",
        creator: "Anthropic",
        displayScore: 85.43,
        url: "https://benchlm.ai/models/claude-opus-5-5",
        scores: { displayCategoryScores: { coding: 87.5, math: null } },
        benchmarks: { coding: { sweVerified: 81.2, helperCount: 3 } },
      },
      { canonicalModelKey: "gpt-6-luna", model: "GPT-6 Luna", displayScore: 65.25 },
      { canonicalModelKey: "gpt-6-luna-medium", model: "GPT-6 Luna (medium)", displayScore: 61 },
      { canonicalModelKey: "gpt-6-luna-low", model: "GPT-6 Luna (low)", displayScore: null },
    ],
  },
  pricing: { items: [{ canonicalModelKey: "claude-opus-5-5", inputPrice: 5, outputPrice: 25 }] },
  speed: { items: [{ canonicalModelKey: "claude-opus-5-5", tokensPerSecond: 72, ttft: 1.4 }] },
  benchmarks: {
    items: [{ benchmarkKey: "sweVerified", name: "SWE-bench Verified", category: "coding" }],
  },
};

describe("benchmark sources", () => {
  it("canonicalizes provider ids and splits effort suffixes", () => {
    expect(canonicalModelKey("anthropic/Claude Opus 5.5[1m]")).toBe("claude-opus-5-5");
    expect(canonicalModelKey("gpt-6.1-sol")).toBe("gpt-6-1-sol");
    expect(splitEffort("GPT-6 Luna (Medium)")).toEqual({ base: "GPT-6 Luna", effort: "medium" });
    expect(splitEffort("Claude Opus 5.5")).toEqual({ base: "Claude Opus 5.5" });
  });

  it("joins BenchLM scores, prices and speed, keeping only described benchmarks", () => {
    const parsed = parseBenchLm(benchLmFeeds);
    const opus = parsed.entries.find((entry) => entry.sourceModelKey === "claude-opus-5-5");
    expect(opus?.values).toEqual({
      "benchLm:overall": 85.43,
      "benchLm:category:coding": 87.5,
      "benchLm:benchmark:sweVerified": 81.2,
      "benchLm:price:input": 5,
      "benchLm:price:output": 25,
      "benchLm:speed": 72,
      "benchLm:ttft": 1.4,
    });
    expect(parsed.entries.find((entry) => entry.name.endsWith("(medium)"))?.effort).toBe("medium");
    expect(
      parsed.metrics.find((metric) => metric.key === "benchLm:price:input")?.higherIsBetter,
    ).toBe(false);
  });

  it("matches the measured effort, or falls back to the default run marked unmeasured", () => {
    const { entries } = parseBenchLm(benchLmFeeds);

    const medium = matchBenchmarks({ modelId: "gpt-6-luna", effort: "medium" }, entries);
    expect(
      medium.map((match) => [match.entry.source, match.entry.name, match.effortMeasured]),
    ).toEqual([["benchLm", "GPT-6 Luna (medium)", true]]);

    const low = matchBenchmarks({ modelId: "gpt-6-luna", effort: "low" }, entries);
    expect(low.map((match) => [match.entry.name, match.effortMeasured])).toEqual([
      ["GPT-6 Luna", false],
    ]);

    const high = matchBenchmarks({ modelId: "gpt-6-luna", effort: "high" }, entries);
    expect(
      high.map((match) => [match.entry.source, match.entry.name, match.effortMeasured]),
    ).toEqual([["benchLm", "GPT-6 Luna", false]]);

    expect(matchBenchmarks({ modelId: "claude-opus-5-5-20261001" }, entries)).toHaveLength(1);
    expect(matchBenchmarks({ modelId: "unknown-model" }, entries)).toEqual([]);
  });
});

const makeHarness = () => {
  const calls: string[] = [];
  let failing = false;
  const http = HttpClient.make((request) => {
    calls.push(request.url);
    if (failing)
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response(null, { status: 503 })),
      );
    const file = request.url.split("/").pop()?.replace(".json", "") as keyof typeof benchLmFeeds;
    return Effect.succeed(HttpClientResponse.fromWeb(request, Response.json(benchLmFeeds[file])));
  });
  const layer = ModelBenchmarks.layer.pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, http)),
  );
  return { calls, layer, fail: () => (failing = true) };
};

describe("ModelBenchmarks", () => {
  it.effect("reports only the metrics the requested models have", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      const service = yield* ModelBenchmarks.ModelBenchmarks;
      const report = yield* service.report([{ modelId: "gpt-6-luna" }]);
      expect(report.sources.map((source) => source.state)).toEqual(["ready"]);
      expect(report.metrics.map((metric) => metric.key)).toEqual(["benchLm:overall"]);
    }).pipe(Effect.provide(harness.layer));
  });

  it.effect("fetches once an hour and keeps the last good copy when a refresh fails", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      const service = yield* ModelBenchmarks.ModelBenchmarks;
      yield* service.report([{ modelId: "claude-opus-5-5" }]);
      expect(harness.calls).toHaveLength(4);

      yield* service.report([{ modelId: "claude-opus-5-5" }]);
      expect(harness.calls).toHaveLength(4);

      harness.fail();
      yield* TestClock.adjust("61 minutes");
      const report = yield* service.report([{ modelId: "claude-opus-5-5" }]);
      expect(harness.calls.length).toBeGreaterThan(4);
      expect(report.sources[0]?.state).toBe("ready");
      expect(report.rows[0]?.matches).toHaveLength(1);
    }).pipe(Effect.provide(harness.layer));
  });

  it.effect("reports the source unavailable when the first fetch fails", () => {
    const harness = makeHarness();
    harness.fail();
    return Effect.gen(function* () {
      const service = yield* ModelBenchmarks.ModelBenchmarks;
      const report = yield* service.report([{ modelId: "claude-opus-5-5" }]);
      expect(report.sources[0]?.state).toBe("unavailable");
      expect(report.rows[0]?.matches).toEqual([]);
    }).pipe(Effect.provide(harness.layer));
  });
});
