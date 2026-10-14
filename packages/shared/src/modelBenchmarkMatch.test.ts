import type { ModelBenchmarkEntry, ModelBenchmarkQuery } from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";

import {
  benchmarkRouteProfiles,
  canonicalModelKey,
  matchBenchmarks,
} from "./modelBenchmarkMatch.ts";

const entry = (name: string, effort?: string): ModelBenchmarkEntry => ({
  source: "benchLm",
  sourceModelKey: canonicalModelKey(name),
  name,
  values: {},
  ...(effort ? { effort } : {}),
});

const CATALOG = [
  entry("Claude Opus 5.5"),
  entry("Gemini 3.8 Flash"),
  entry("o3-mini"),
  entry("Gemma 4 31B"),
  entry("Qwen3.8 Max"),
  entry("GPT-5.1 Codex Max"),
  entry("GPT-6 Luna"),
  entry("GPT-6 Luna (high)", "high"),
  entry("DeepSeek V4 Pro"),
  entry("DeepSeek V4 Pro 0813"),
];

const matched = (query: ModelBenchmarkQuery) => {
  const match = matchBenchmarks(query, CATALOG)[0];
  return match ? `${match.entry.name}${match.effortMeasured ? "" : " ~"}` : "MISS";
};

// Real ids from connected providers (Claude, Codex, OpenRouter, Antigravity) that used to miss.
describe("matchBenchmarks across providers", () => {
  it("drops OpenRouter routing tags and vendor label prefixes", () => {
    assert.equal(
      matched({
        modelId: "anthropic/claude-opus-5.5:batch",
        displayName: "Anthropic: Claude Opus 5.5 (batch)",
      }),
      "Claude Opus 5.5",
    );
    assert.equal(matched({ modelId: "google/gemma-4-31b-it:free" }), "Gemma 4 31B");
  });

  it("reads effort baked into the slug", () => {
    assert.equal(
      matched({ modelId: "gemini-3.8-flash-high", displayName: "Gemini 3.8 Flash (High)" }),
      "Gemini 3.8 Flash ~",
    );
    assert.equal(matched({ modelId: "openai/o3-mini-high" }), "o3-mini ~");
    assert.equal(matched({ modelId: "gpt-6-luna-high" }), "GPT-6 Luna (high)");
  });

  it("keeps a model whose own name ends in an effort word", () => {
    assert.equal(matched({ modelId: "openai/gpt-5.1-codex-max" }), "GPT-5.1 Codex Max");
  });

  it("prefers an exact dated release, then falls back past short date tails", () => {
    assert.equal(matched({ modelId: "deepseek/deepseek-v4-pro-0813" }), "DeepSeek V4 Pro 0813");
    assert.equal(matched({ modelId: "qwen/qwen3.8-max-0902" }), "Qwen3.8 Max");
  });

  it("matches Claude and Codex slugs with explicit effort", () => {
    assert.equal(matched({ modelId: "claude-opus-5-5", effort: "high" }), "Claude Opus 5.5 ~");
    assert.equal(matched({ modelId: "gpt-6-luna", effort: "high" }), "GPT-6 Luna (high)");
  });
});

describe("benchmarkRouteProfiles", () => {
  const scored = (name: string, overall: number, speed: number, price: number) => ({
    ...entry(name),
    values: { "benchLm:overall": overall, "benchLm:speed": speed, "benchLm:price:output": price },
  });
  const guess = () => ({ quality: 3, speed: 3, economy: 3 });

  it("ranks measured models into 1-5 quintiles and skips unknown slugs", () => {
    const entries = [
      scored("Top Model", 90, 20, 30),
      scored("Mid Model", 60, 80, 5),
      scored("Low Model", 30, 200, 0.5),
    ];
    const profiles = benchmarkRouteProfiles(entries, ["top-model", "low-model", "mystery"], guess);
    assert.deepEqual(profiles.get("top-model"), { quality: 4, speed: 1, economy: 1, known: true });
    assert.deepEqual(profiles.get("low-model"), { quality: 1, speed: 4, economy: 4, known: true });
    assert.equal(profiles.has("mystery"), false);
  });
});
