import { describe, expect, it } from "vite-plus/test";

import { openRouterLimitsFromBalances } from "./openRouterUsageLimits.ts";

const checkedAt = "2026-10-14T00:00:00.000Z";

describe("openRouterLimitsFromBalances", () => {
  it("shows the credit balance instead of subscription windows", () => {
    const limits = openRouterLimitsFromBalances({
      checkedAt,
      credits: { totalCredits: 20, totalUsage: 5 },
      key: undefined,
    });
    expect(limits.unavailable).toBeUndefined();
    expect(limits.windows).toEqual([
      expect.objectContaining({ label: "Credits · $15.00 left", usedPercent: 25 }),
    ]);
  });

  it("adds the per-key cap when one is set", () => {
    const limits = openRouterLimitsFromBalances({
      checkedAt,
      credits: { totalCredits: 20, totalUsage: 5 },
      key: { usage: 2, limit: 10, remaining: 8 },
    });
    expect(limits.windows.map((window) => window.label)).toEqual([
      "Credits · $15.00 left",
      "Key cap · $8.00 left",
    ]);
  });

  it("reports a failed probe when nothing came back", () => {
    const limits = openRouterLimitsFromBalances({ checkedAt, credits: undefined, key: undefined });
    expect(limits.unavailable?.reason).toBe("probeFailed");
  });
});
