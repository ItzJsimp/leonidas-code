import { describe, expect, it } from "@effect/vitest";

import { aggregateRunStats } from "./ModelRunStats.ts";

const row = (
  status: string,
  seconds: number | null,
  extra: Partial<{ model: string; effort: string | null; attempts: number }> = {},
) => ({
  model: extra.model ?? "claude-sonnet-5-5",
  effort: extra.effort === undefined ? "medium" : extra.effort,
  status,
  requestedAt: "2026-10-14T10:00:00.000Z",
  startedAt: seconds === null ? null : "2026-10-14T10:00:00.000Z",
  completedAt:
    seconds === null
      ? null
      : `2026-10-14T10:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.000Z`,
  attempts: extra.attempts ?? 1,
});

describe("aggregateRunStats", () => {
  it("groups by model and effort, counts outcomes and takes the median time", () => {
    const [stat] = aggregateRunStats([
      row("completed", 10),
      row("completed", 30),
      row("completed", 20, { attempts: 2 }),
      row("failed", null),
      row("interrupted", null),
      row("cancelled", null),
      row("running", null),
    ]);
    expect(stat).toMatchObject({
      model: "claude-sonnet-5-5",
      effort: "medium",
      runs: 6,
      completed: 3,
      failed: 2,
      cancelled: 1,
      retried: 1,
      medianSeconds: 20,
    });
  });

  it("keeps effort-less runs separate and skips rows without a model", () => {
    const stats = aggregateRunStats([
      row("completed", 5, { model: "gemini-3.8-flash-medium", effort: null }),
      row("completed", 5, { model: "" }),
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0]!.effort).toBeUndefined();
  });
});
