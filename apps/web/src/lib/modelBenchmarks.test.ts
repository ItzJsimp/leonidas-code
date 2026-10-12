import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ModelBenchmarkMetric,
  type ModelBenchmarkReport,
  type ServerProvider,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveProviderInstanceEntries } from "../providerInstances";
import {
  benchmarkQueries,
  connectedBenchmarkCandidates,
  rankBenchmarkCandidates,
} from "./modelBenchmarks";

function provider(
  instanceId: string,
  models: ServerProvider["models"],
  status: ServerProvider["status"] = "ready",
): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(instanceId),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: null,
    status,
    auth: { status: "authenticated" },
    checkedAt: "2026-01-01T00:00:00.000Z",
    models,
    slashCommands: [],
    skills: [],
  };
}

const effortModel: ServerProvider["models"][number] = {
  slug: "gpt-6",
  name: "GPT-6",
  isCustom: false,
  capabilities: {
    optionDescriptors: [
      {
        id: "reasoningEffort",
        label: "Reasoning",
        type: "select",
        options: [
          { id: "low", label: "Low" },
          { id: "high", label: "High" },
        ],
      },
    ],
  },
};
const plainModel: ServerProvider["models"][number] = {
  slug: "mini",
  name: "Mini",
  isCustom: false,
  capabilities: null,
};

const score: ModelBenchmarkMetric = {
  key: "overall",
  source: "benchLm",
  label: "Overall",
  kind: "score",
  unit: "score",
  higherIsBetter: true,
};

describe("connectedBenchmarkCandidates", () => {
  it("lists each effort of ready providers and shares queries across instances", () => {
    const entries = deriveProviderInstanceEntries([
      provider("codex", [effortModel, plainModel]),
      provider("codex_work", [effortModel]),
      provider("codex_broken", [plainModel], "error"),
    ]);
    const candidates = connectedBenchmarkCandidates(entries);

    expect(candidates.map((candidate) => [candidate.modelName, candidate.effortLabel])).toEqual([
      ["GPT-6", "Low"],
      ["GPT-6", "High"],
      ["Mini", null],
      ["GPT-6", "Low"],
      ["GPT-6", "High"],
    ]);
    expect(candidates[1]?.selection).toEqual({
      instanceId: "codex",
      model: "gpt-6",
      options: [{ id: "reasoningEffort", value: "high" }],
    });
    expect(benchmarkQueries(candidates)).toEqual([
      { modelId: "gpt-6", displayName: "GPT-6", effort: "low" },
      { modelId: "gpt-6", displayName: "GPT-6", effort: "high" },
      { modelId: "mini", displayName: "Mini" },
    ]);
  });
});

describe("rankBenchmarkCandidates", () => {
  const candidates = connectedBenchmarkCandidates(
    deriveProviderInstanceEntries([provider("codex", [effortModel, plainModel])]),
  );
  const entry = (name: string, overall: number) => ({
    source: "benchLm" as const,
    sourceModelKey: name,
    name,
    values: { overall },
  });
  const report: ModelBenchmarkReport = {
    sources: [],
    metrics: [score],
    rows: [
      {
        query: { modelId: "gpt-6", effort: "low" },
        matches: [{ entry: entry("GPT-6", 60), effortMeasured: false }],
      },
      {
        query: { modelId: "gpt-6", effort: "high" },
        matches: [{ entry: entry("GPT-6 (high)", 80), effortMeasured: true }],
      },
      { query: { modelId: "mini" }, matches: [] },
    ],
  };

  it("puts the best first, marks fallbacks and leaves unknown models at the bottom", () => {
    const ranked = rankBenchmarkCandidates(candidates, report, score);
    expect(
      ranked.map((row) => [row.candidate.effortLabel ?? row.candidate.modelName, row.value]),
    ).toEqual([
      ["High", 80],
      ["Low", 60],
      ["Mini", null],
    ]);
    expect(ranked.map((row) => row.tier)).toEqual(["top", "bottom", null]);
    expect(ranked.map((row) => row.effortMeasured)).toEqual([true, false, false]);
    expect(ranked[1]?.fraction).toBe(0.75);
  });

  it("ranks lower values first when lower is better", () => {
    const ranked = rankBenchmarkCandidates(candidates, report, {
      ...score,
      kind: "price",
      higherIsBetter: false,
    });
    expect(ranked.map((row) => row.value)).toEqual([60, 80, null]);
  });
});
