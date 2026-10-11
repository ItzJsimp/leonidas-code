import { describe, expect, it } from "@effect/vitest";

import {
  antigravityUserStatusToLimits,
  antigravityUserStatusToUpdate,
  antigravityUserStatusToWindows,
  resolveLanguageServerCandidates,
  evaluateAntigravityQuotaArbitrage,
  type AntigravityUserStatus,
} from "./antigravityUsageLimits.ts";

describe("antigravityUsageLimits", () => {
  const sampleUserStatus: AntigravityUserStatus = {
    name: "Gersi",
    email: "simplygersi@gmail.com",
    planStatus: {
      planInfo: {
        planName: "Pro",
        teamsTier: "TEAMS_TIER_PRO",
      },
    },
    cascadeModelConfigData: {
      clientModelConfigs: [
        {
          label: "Claude Sonnet 5.5 (Medium)",
          quotaInfo: {
            remainingFraction: 0.3335724,
            resetTime: "2026-10-11T09:14:20Z",
          },
        },
        {
          label: "Gemini 3.8 Flash (Medium)",
          quotaInfo: {
            remainingFraction: 0.4856189,
            resetTime: "2026-10-11T05:17:22Z",
          },
        },
      ],
    },
  };

  it("extracts session and weekly quota windows from userStatus", () => {
    const windows = antigravityUserStatusToWindows(sampleUserStatus);
    expect(windows).toHaveLength(2);

    const session = windows.find((w) => w.id === "session");
    expect(session).toBeDefined();
    expect(session?.kind).toBe("session");
    expect(session?.label).toBe("Session");
    expect(session?.windowDurationMins).toBe(300);
    // 1 - 0.4856189 = 0.5143811 -> 51%
    expect(session?.usedPercent).toBe(51);
    expect(session?.resetsAt).toBe("2026-10-11T05:17:22Z");

    const weekly = windows.find((w) => w.id === "weekly");
    expect(weekly).toBeDefined();
    expect(weekly?.kind).toBe("weekly");
    expect(weekly?.label).toBe("Weekly");
    expect(weekly?.windowDurationMins).toBe(10080);
    // 1 - 0.3335724 = 0.6664276 -> 67%
    expect(weekly?.usedPercent).toBe(67);
    expect(weekly?.resetsAt).toBe("2026-10-11T09:14:20Z");
  });

  it("handles missing configs by returning empty windows", () => {
    expect(antigravityUserStatusToWindows(null)).toEqual([]);
    expect(antigravityUserStatusToWindows({})).toEqual([]);
    expect(
      antigravityUserStatusToWindows({
        cascadeModelConfigData: { clientModelConfigs: [] },
      }),
    ).toEqual([]);
  });

  it("creates ServerProviderUsageLimits with checkedAt", () => {
    const checkedAt = "2026-10-11T04:00:00.000Z";
    const limits = antigravityUserStatusToLimits({
      userStatus: sampleUserStatus,
      checkedAt,
    });
    expect(limits.checkedAt).toBe(checkedAt);
    expect(limits.windows).toHaveLength(2);
    expect(limits.unavailable).toBeUndefined();
  });

  it("returns unavailable when no quotas are reported", () => {
    const checkedAt = "2026-10-11T04:00:00.000Z";
    const limits = antigravityUserStatusToLimits({
      userStatus: { name: "Test" },
      checkedAt,
    });
    expect(limits.unavailable?.reason).toBe("probeFailed");
    expect(limits.windows).toEqual([]);
  });

  it("creates a sparse ProviderUsageLimitsUpdate", () => {
    const update = antigravityUserStatusToUpdate(sampleUserStatus);
    expect(update?.windows).toHaveLength(2);
  });

  it("resolves candidate executable paths on the platform", () => {
    const candidates = resolveLanguageServerCandidates();
    expect(candidates.length).toBeGreaterThan(0);
  });
  describe("evaluateAntigravityQuotaArbitrage", () => {
    it("flags opportunistic surplus when under-utilized nearing reset", () => {
      const now = Date.parse("2026-10-11T04:30:00Z");
      const window = {
        id: "session",
        kind: "session" as const,
        label: "Session",
        usedPercent: 30,
        windowDurationMins: 300,
        resetsAt: "2026-10-11T05:00:00Z", // 30 mins left
      };
      const result = evaluateAntigravityQuotaArbitrage(window, now);
      expect(result.minutesUntilReset).toBe(30);
      expect(result.opportunisticDispatchEligible).toBe(true);
      expect(result.recommendation).toBe("opportunistic_surplus");
    });

    it("flags conserve_quota when limit is near capacity", () => {
      const now = Date.parse("2026-10-11T04:00:00Z");
      const window = {
        id: "session",
        kind: "session" as const,
        label: "Session",
        usedPercent: 90,
        windowDurationMins: 300,
        resetsAt: "2026-10-11T05:00:00Z",
      };
      const result = evaluateAntigravityQuotaArbitrage(window, now);
      expect(result.recommendation).toBe("conserve_quota");
      expect(result.burnPace).toBe("deficit");
    });
  });
});
