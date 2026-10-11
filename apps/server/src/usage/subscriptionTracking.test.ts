import { describe, expect, it } from "@effect/vitest";
import { advanceSubscriptionWindow, emptyTotals } from "./subscriptionTracking.ts";

const window = {
  id: "five_hour",
  kind: "session" as const,
  label: "Session",
  usedPercent: 20,
  resetsAt: "2026-10-11T05:00:00Z",
};
const at = Date.parse("2026-10-11T00:00:00Z");
const tokens = {
  ...emptyTotals(),
  uncachedInputTokens: 20_000,
  cachedInputTokens: 20_000,
  outputTokens: 10_000,
  reasoningTokens: 8_000,
};
const baseline = () => advanceSubscriptionWindow(undefined, window, at, null).state;

describe("subscription token calibration", () => {
  it("uses percentage-point deltas and counts reasoning only once", () => {
    const result = advanceSubscriptionWindow(
      baseline(),
      { ...window, usedPercent: 30 },
      at + 60_000,
      tokens,
    );
    expect(result.estimate.observedTokens).toEqual(tokens);
    expect(result.estimate.observedPercent).toBe(10);
    expect(result.estimate.capacityTokens).toBe(500_000);
    expect(result.estimate.remainingTokens).toBe(350_000);
  });
  it("accumulates tokens while the provider percentage stays rounded", () => {
    const first = advanceSubscriptionWindow(baseline(), window, at + 60_000, tokens);
    expect(first.estimate.capacityTokens).toBeUndefined();
    const next = advanceSubscriptionWindow(
      first.state,
      { ...window, usedPercent: 30 },
      at + 120_000,
      tokens,
    );
    expect(next.estimate.capacityTokens).toBe(1_000_000);
  });
  it.each([
    { ...window, usedPercent: 0 },
    { ...window, usedPercent: 30, resetsAt: "2026-10-11T10:00:00Z" },
  ])("starts a new baseline on resets", (reset) => {
    const result = advanceSubscriptionWindow(baseline(), reset, at + 60_000, tokens);
    expect(result.estimate.capacityTokens).toBeUndefined();
    expect(result.estimate.observedPercent).toBe(0);
  });
  it("refuses weak samples, missing telemetry, expired windows and model-specific quotas", () => {
    expect(
      advanceSubscriptionWindow(baseline(), { ...window, usedPercent: 21 }, at + 60_000, tokens)
        .estimate.capacityTokens,
    ).toBeUndefined();
    expect(
      advanceSubscriptionWindow(baseline(), { ...window, usedPercent: 30 }, at + 60_000, null)
        .estimate.status,
    ).toBe("unavailable");
    expect(
      advanceSubscriptionWindow(baseline(), window, Date.parse(window.resetsAt), tokens).estimate
        .status,
    ).toBe("unavailable");
    expect(
      advanceSubscriptionWindow(undefined, { ...window, id: "seven_day_sonnet" }, at, tokens)
        .estimate.status,
    ).toBe("unavailable");
  });
  it("does not count duplicate or out-of-order snapshots twice", () => {
    const first = advanceSubscriptionWindow(
      baseline(),
      { ...window, usedPercent: 30 },
      at + 60_000,
      tokens,
    );
    const duplicate = advanceSubscriptionWindow(
      first.state,
      { ...window, usedPercent: 30 },
      at + 60_000,
      tokens,
    );
    expect(duplicate.state).toEqual(first.state);
  });
  it("does not invent tokens when the quota rises outside the local transcripts", () => {
    const result = advanceSubscriptionWindow(
      baseline(),
      { ...window, usedPercent: 30 },
      at + 60_000,
      emptyTotals(),
    );
    expect(result.estimate.capacityTokens).toBeUndefined();
    expect(result.estimate.status).toBe("unavailable");
  });
  it("retains pending tokens when the quota report arrives one snapshot late", () => {
    const pending = advanceSubscriptionWindow(baseline(), window, at + 60_000, tokens);
    const next = advanceSubscriptionWindow(
      pending.state,
      { ...window, usedPercent: 30 },
      at + 120_000,
      emptyTotals(),
    );
    expect(next.estimate.capacityTokens).toBe(500_000);
  });
});
