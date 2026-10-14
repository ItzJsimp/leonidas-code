import type { ModelTotals, ProviderTotals, SourceTotals } from "@t3tools/shared/usageMerge";
import { describe, expect, it } from "vite-plus/test";

import {
  cacheHitRate,
  costPerMillionTokens,
  displayModelName,
  freeModelKind,
  freshTokens,
  modelShare,
  accountBreakdownRows,
  providerBreakdownRows,
  sortModelsByTokens,
  usageHighlights,
} from "./usageBreakdown";
import type { MergedUsage } from "@t3tools/shared/usageMerge";

const model = (
  name: string,
  totalTokens: number,
  costUsd: number,
  overrides: Partial<ModelTotals> = {},
): ModelTotals => ({
  model: name,
  provider: "codex",
  costUsd,
  totalTokens,
  tokens: {
    uncachedInputTokens: totalTokens,
    cachedInputTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
  },
  records: 1,
  unpricedRecords: 0,
  unpricedTokens: 0,
  costShare: 0,
  tokenShare: 0,
  ...overrides,
});

describe("sortModelsByTokens", () => {
  it("sorts by tokens, breaks ties by cost, and leaves the input alone", () => {
    const models = [
      model("lower-cost", 100, 1),
      model("more-tokens", 200, 2),
      model("higher-cost", 100, 3),
    ];

    expect(sortModelsByTokens(models).map((item) => item.model)).toEqual([
      "more-tokens",
      "higher-cost",
      "lower-cost",
    ]);
    expect(models.map((item) => item.model)).toEqual(["lower-cost", "more-tokens", "higher-cost"]);
  });
});

describe("modelShare", () => {
  it("follows the selected metric", () => {
    const priced = model("priced", 100, 9, { costShare: 0.9, tokenShare: 0.25 });

    expect(modelShare(priced, "cost")).toBe(0.9);
    expect(modelShare(priced, "tokens")).toBe(0.25);
  });

  it("has no cost share for an unknown cost but keeps its token share", () => {
    const unpriced = model("unpriced", 300, 0, {
      unpricedRecords: 1,
      unpricedTokens: 300,
      tokenShare: 0.75,
    });

    expect(modelShare(unpriced, "cost")).toBeNull();
    expect(modelShare(unpriced, "tokens")).toBe(0.75);
  });
});

describe("model rates", () => {
  it("counts cache writes as misses and leaves unpriced tokens out of $/1M", () => {
    const mixed = model("mixed", 4_000_000, 6, {
      tokens: {
        uncachedInputTokens: 1_000_000,
        cachedInputTokens: 1_000_000,
        cacheCreationTokens: 2_000_000,
        outputTokens: 0,
        reasoningTokens: 0,
      },
      records: 4,
      unpricedRecords: 1,
      unpricedTokens: 1_000_000,
    });

    expect(cacheHitRate(mixed)).toBe(0.25);
    expect(costPerMillionTokens(mixed)).toBe(2);
    expect(costPerMillionTokens({ ...mixed, unpricedRecords: 4 })).toBeNull();
  });
});

describe("usageHighlights", () => {
  const fmt = {
    tokens: (n: number) => `${Math.round(n)}t`,
    usd: (n: number) => `$${n.toFixed(2)}`,
  };
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const merged = {
    models: [model("small", 10, 0, { tokenShare: 0.1 }), model("big", 90, 0, { tokenShare: 0.9 })],
    totalTokens: 100,
    uncachedInputTokens: 20,
    cachedInputTokens: 60,
    cacheCreationTokens: 0,
    outputTokens: 20,
    sessions: 4,
    costUsd: 8,
    costQuality: { cacheSavingsUsd: 3 },
  } as unknown as MergedUsage;

  it("reports the top model, cache hit rate, per-session and output share", () => {
    expect(usageHighlights(merged, fmt, pct)).toEqual([
      { label: "Top model", value: "big", detail: "90% of tokens" },
      { label: "Cache hit rate", value: "75%", detail: "$3.00 saved" },
      { label: "Per session", value: "25t", detail: "$2.00 avg" },
      { label: "Output share", value: "20%", detail: "20t generated" },
    ]);
  });

  it("shows nothing for an empty window", () => {
    const empty = {
      ...merged,
      models: [],
      totalTokens: 0,
      uncachedInputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      sessions: 0,
    } as unknown as MergedUsage;
    expect(usageHighlights(empty, fmt, pct)).toEqual([]);
  });
});

describe("freshTokens", () => {
  it("counts uncached input, cache writes and output but not cache reads", () => {
    const tokens = {
      uncachedInputTokens: 32,
      cachedInputTokens: 1_000,
      cacheCreationTokens: 8,
      outputTokens: 4,
      reasoningTokens: 3,
    };
    expect(freshTokens(tokens)).toBe(44);
  });
});

describe("displayModelName", () => {
  it("labels placeholder and unmapped ids instead of showing the raw slug", () => {
    expect(displayModelName("antigravity-unknown")).toBe("Unattributed");
    expect(displayModelName("antigravity-model-1319")).toBe("Antigravity model 1319 (unmapped)");
    expect(displayModelName("gemini-3-pro")).toBe("gemini-3-pro");
  });
});

describe("providerBreakdownRows", () => {
  const source = (sourcePath: string | undefined, totalTokens: number): SourceTotals => ({
    sourcePath,
    costUsd: 0,
    totalTokens,
    records: 1,
    sessions: 1,
  });
  const provider = (
    kind: ProviderTotals["provider"],
    sources: readonly SourceTotals[],
  ): ProviderTotals => ({
    provider: kind,
    costUsd: 0,
    totalTokens: sources.reduce((sum, entry) => sum + entry.totalTokens, 0),
    records: sources.length,
    sessions: sources.length,
    costShare: 0,
    tokenShare: 0,
    sources,
  });

  it("splits a provider with two homes into labelled accounts and leaves single-home providers whole", () => {
    const rows = providerBreakdownRows([
      provider("claude", [
        source("C:\\Users\\Jake\\.claude", 90),
        source("C:\\Users\\Jake\\.claude-simplygersi", 10),
      ]),
      provider("codex", [source("/home/jake/.codex", 5)]),
    ]);

    expect(rows[0]?.sources.map((entry) => [entry.label, entry.totals.totalTokens])).toEqual([
      ["default", 90],
      ["simplygersi", 10],
    ]);
    expect(rows[1]?.sources).toEqual([]);
  });

  it("falls back to the full path when two homes share a folder name, and labels missing paths", () => {
    const rows = providerBreakdownRows([
      provider("claude", [source("/mac/.claude", 2), source("/linux/.claude", 1)]),
      provider("opencode", [source(undefined, 2), source("/home/jake/.local/share/opencode", 1)]),
    ]);

    expect(rows[0]?.sources.map((entry) => entry.label)).toEqual([
      "/mac/.claude",
      "/linux/.claude",
    ]);
    expect(rows[1]?.sources.map((entry) => entry.label)).toEqual(["Other", "default"]);
  });
});

describe("accountBreakdownRows", () => {
  it("flattens every home into one list, largest first, across providers", () => {
    const src = (sourcePath: string, totalTokens: number): SourceTotals => ({
      sourcePath,
      costUsd: 0,
      totalTokens,
      records: 1,
      sessions: 1,
    });
    const prov = (kind: ProviderTotals["provider"], sources: SourceTotals[]): ProviderTotals => ({
      provider: kind,
      costUsd: 0,
      totalTokens: 0,
      records: 1,
      sessions: 1,
      costShare: 0,
      tokenShare: 0,
      sources,
    });
    const rows = accountBreakdownRows([
      prov("claude", [src("/h/.claude", 10), src("/h/.claude-work", 50)]),
      prov("codex", [src("/h/.codex", 30)]),
    ]);
    expect(rows.map((row) => [row.provider, row.label])).toEqual([
      ["claude", "work"],
      ["codex", "default"],
      ["claude", "default"],
    ]);
  });
});

describe("freeModelKind", () => {
  it("marks free OpenRouter routes and local models, and nothing else", () => {
    expect(freeModelKind("apodex/apodex-1.1-mini:free")).toBe("free");
    expect(freeModelKind("ollama/llama3")).toBe("local");
    expect(freeModelKind("lmstudio:qwen")).toBe("local");
    expect(freeModelKind("gpt-6-luna")).toBeNull();
    expect(freeModelKind("antigravity-unknown")).toBeNull();
  });
});
