import type { ModelBenchmarkEntry } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { BenchmarkCandidate } from "./modelBenchmarks";
import {
  addArenaMatch,
  bestRunnableNow,
  EMPTY_ARENA,
  effortCurves,
  newChallengers,
  recordArenaVote,
  runStatsByEntry,
} from "./benchmarkInsights";

const entry = (name: string, values: Record<string, number>, effort?: string) =>
  ({
    source: "benchLm",
    sourceModelKey: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    values,
    ...(effort ? { effort } : {}),
  }) as ModelBenchmarkEntry;

const candidate = (quota: BenchmarkCandidate["quota"]) =>
  ({ quota, selection: { instanceId: "x", model: "m" } }) as unknown as BenchmarkCandidate;

describe("benchmark insights", () => {
  it("folds run stats onto entries and excludes cancels from success", () => {
    const stats = runStatsByEntry(
      [entry("Claude Sonnet 5.5", {})],
      [
        {
          model: "claude-sonnet-5-5",
          effort: "medium",
          runs: 10,
          completed: 8,
          failed: 1,
          cancelled: 1,
          retried: 0,
          medianSeconds: 20,
        },
        {
          model: "claude-sonnet-5-5",
          effort: "low",
          runs: 4,
          completed: 4,
          failed: 0,
          cancelled: 0,
          retried: 1,
          medianSeconds: 10,
        },
      ],
    );
    const sonnet = stats.get("claude-sonnet-5-5");
    expect(sonnet?.runs).toBe(14);
    expect(sonnet?.successRate).toBeCloseTo(12 / 13);
    expect(sonnet?.medianSeconds).toBeCloseTo((20 * 8 + 10 * 4) / 12);
  });

  it("picks the best runnable model and skips exhausted accounts", () => {
    const strong = entry("Strong", { s: 90 });
    const decent = entry("Decent", { s: 70 });
    const best = bestRunnableNow(
      [strong, decent],
      new Map([
        [strong.sourceModelKey, candidate({ kind: "subscription", leftPercent: 0 })],
        [decent.sourceModelKey, candidate({ kind: "subscription", leftPercent: 40 })],
      ]),
      "s",
    );
    expect(best?.entry.name).toBe("Decent");
  });

  it("moves ratings once per vote", () => {
    let state = addArenaMatch(EMPTY_ARENA, {
      id: "m1",
      prompt: "p",
      createdAt: "t",
      contestants: [
        { label: "A", entryKey: "a", name: "A", threadId: "t1" },
        { label: "B", entryKey: "b", name: "B", threadId: "t2" },
      ],
    });
    state = recordArenaVote(state, "m1", "A");
    expect(state.ratings.a!.elo).toBe(1016);
    expect(state.ratings.b!.elo).toBe(984);
    expect(recordArenaVote(state, "m1", "B")).toBe(state);
  });

  it("flags new models that beat what you can run, never on first visit", () => {
    const entries = [entry("Old", { s: 80 }), entry("New", { s: 85 }), entry("Weak", { s: 50 })];
    expect(newChallengers(entries, null, "s", 80)).toEqual([]);
    const seen = { keys: ["old"], takenAt: "t" };
    expect(newChallengers(entries, seen, "s", 80).map((item) => item.name)).toEqual(["New"]);
  });

  it("groups effort variants into lightest-first curves", () => {
    const point = (e: ModelBenchmarkEntry) => ({ entry: e, x: 1, y: 1 });
    const curves = effortCurves([
      point(entry("GPT-6 Luna (high)", {}, "high")),
      point(entry("GPT-6 Luna", {})),
      point(entry("GPT-6 Luna (low)", {}, "low")),
      point(entry("Solo", {})),
    ]);
    expect(curves).toHaveLength(1);
    expect(curves[0]!.map((item) => item.entry.effort ?? "default")).toEqual([
      "default",
      "low",
      "high",
    ]);
  });
});
