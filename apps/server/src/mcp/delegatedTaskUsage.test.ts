import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";

import { delegatedTaskUsage } from "./delegatedTaskUsage.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);
const now = at("2026-10-14T12:00:00Z");
const complete = (inputTokens: number, outputTokens: number, cachedInputTokens?: number) => ({
  turnTokenUsage: {
    usageScope: "main_agent" as const,
    hasSubagents: false,
    usageStatus: "complete" as const,
    inputTokens,
    outputTokens,
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
  },
});

describe("delegatedTaskUsage", () => {
  it("sums provider-reported tokens when every turn is complete", () => {
    const usage = delegatedTaskUsage(
      [complete(100, 20, 60), complete(50, 5)],
      [{ startedAt: at("2026-10-14T11:00:00Z"), completedAt: at("2026-10-14T11:01:30Z") }],
      now,
    );
    assert.deepStrictEqual(usage, {
      usageStatus: "complete",
      inputTokens: 150,
      outputTokens: 25,
      cachedInputTokens: 60,
      reasoningTokens: null,
      providerTurnCount: 2,
      runCount: 1,
      wallTimeMs: 90_000,
    });
  });

  it("marks mixed reports partial and counts a running run up to now", () => {
    const usage = delegatedTaskUsage(
      [complete(10, 1), {}],
      [{ startedAt: at("2026-10-14T11:59:00Z"), completedAt: null }],
      now,
    );
    assert.equal(usage.usageStatus, "partial");
    assert.equal(usage.inputTokens, 10);
    assert.equal(usage.wallTimeMs, 60_000);
  });

  it("never estimates when no turn reported usage", () => {
    const usage = delegatedTaskUsage([{}], [{ startedAt: null, completedAt: null }], now);
    assert.equal(usage.usageStatus, "unavailable");
    assert.isNull(usage.inputTokens);
    assert.isNull(usage.outputTokens);
    assert.isNull(usage.wallTimeMs);
    assert.equal(usage.providerTurnCount, 1);
  });
});
