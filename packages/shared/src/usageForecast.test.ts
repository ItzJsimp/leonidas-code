import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";

import {
  buildUsageHistoryProfile,
  forecastWindowUsedPercentAtReset,
  type UsageObservationPoint,
} from "./usageForecast.ts";

const HOUR = 60 * 60 * 1000;
// Sunday 2026-10-11 22:00:00 UTC
const SUNDAY_2200 = Date.parse("2026-10-11T22:00:00Z");

const window = (
  usedPercent: number,
  hoursLeft: number,
  windowDurationMins = 300,
  projectedUsedPercentAtReset?: number,
): ServerProviderUsageWindow => ({
  id: "session",
  kind: "session",
  label: "Session",
  usedPercent,
  windowDurationMins,
  resetsAt: DateTime.formatIso(DateTime.makeUnsafe(SUNDAY_2200 + hoursLeft * HOUR)),
  ...(projectedUsedPercentAtReset !== undefined ? { projectedUsedPercentAtReset } : {}),
});

describe("usageForecast", () => {
  describe("buildUsageHistoryProfile", () => {
    it("accumulates hourly burn rates across diurnal slots", () => {
      const observations: UsageObservationPoint[] = [
        // Sunday 18:00 to 20:00 (2 hours, 20% burn = 10%/hr)
        { checkedAt: SUNDAY_2200 - 4 * HOUR, usedPercent: 10, resetsAt: "2026-10-11T23:00:00Z" },
        { checkedAt: SUNDAY_2200 - 2 * HOUR, usedPercent: 30, resetsAt: "2026-10-11T23:00:00Z" },
        // Sunday 20:00 to 22:00 (2 hours, 4% burn = 2%/hr)
        { checkedAt: SUNDAY_2200, usedPercent: 34, resetsAt: "2026-10-11T23:00:00Z" },
      ];

      const profile = buildUsageHistoryProfile(observations);
      expect(profile.sampleCount).toBe(2);
      expect(profile.globalBurnPerHour).toBeCloseTo(6, 1);

      // Sunday is day 0
      const slot19 = profile.weeklySlots[0]![19]!;
      expect(slot19.ratePerHour).toBeCloseTo(10, 1);

      const slot21 = profile.weeklySlots[0]![21]!;
      expect(slot21.ratePerHour).toBeCloseTo(2, 1);
    });

    it("ignores intervals crossing reset boundaries where usage resets", () => {
      const observations: UsageObservationPoint[] = [
        { checkedAt: SUNDAY_2200 - 4 * HOUR, usedPercent: 80, resetsAt: "2026-10-11T20:00:00Z" },
        // Reset happened: usedPercent dropped to 5
        { checkedAt: SUNDAY_2200 - 2 * HOUR, usedPercent: 5, resetsAt: "2026-10-12T01:00:00Z" },
        { checkedAt: SUNDAY_2200, usedPercent: 15, resetsAt: "2026-10-12T01:00:00Z" },
      ];

      const profile = buildUsageHistoryProfile(observations);
      expect(profile.sampleCount).toBe(1);
      expect(profile.globalBurnPerHour).toBeCloseTo(5, 1);
    });
  });

  describe("forecastWindowUsedPercentAtReset", () => {
    it("returns explicit projectedUsedPercentAtReset when already attached", () => {
      const win = window(80, 2, 300, 83.5);
      expect(forecastWindowUsedPercentAtReset(win, SUNDAY_2200)).toBe(83.5);
    });

    it("falls back to real-time session pace when history is empty", () => {
      // 40% after 2.5 hours in a 5-hour window -> pace = 16%/hr -> 80% at reset
      const win = window(40, 2.5, 300);
      const forecast = forecastWindowUsedPercentAtReset(win, SUNDAY_2200);
      expect(forecast).toBeCloseTo(80, 1);
    });

    it("predicts low night burn when user history shows near-zero activity at that hour", () => {
      // History: across several past Sunday nights (22:00 to 02:00), Jake only burns 1%/hr
      const pastSundayNight1 = SUNDAY_2200 - 7 * 24 * HOUR;
      const observations: UsageObservationPoint[] = [
        { checkedAt: pastSundayNight1, usedPercent: 70, resetsAt: "2026-10-05T03:00:00Z" },
        {
          checkedAt: pastSundayNight1 + 2 * HOUR,
          usedPercent: 72,
          resetsAt: "2026-10-05T03:00:00Z",
        },
        {
          checkedAt: pastSundayNight1 + 4 * HOUR,
          usedPercent: 74,
          resetsAt: "2026-10-05T03:00:00Z",
        },
      ];

      // Current session: account is at 80% with 2 hours left.
      // Naive current-window pace (80% in 3h = 26.6%/hr) would predict 133% (runaway exhaustion).
      // But historical pattern predicts Jake only burns ~1-2% during these quiet hours.
      const win = window(80, 2, 300);
      const forecast = forecastWindowUsedPercentAtReset(win, SUNDAY_2200, observations);

      expect(forecast).not.toBeNull();
      // Historical integration is ~82%, blended with pace stays well under 100%
      expect(forecast!).toBeLessThan(95);
      expect(forecast!).toBeGreaterThanOrEqual(80);
    });

    it("predicts elevated burn when approaching a historical peak work hour", () => {
      // History: heavy coding peak between 14:00 and 17:00 (burn ~25%/hr)
      const mondayNoon = Date.parse("2026-10-12T14:00:00Z");
      const pastMondayNoon = mondayNoon - 7 * 24 * HOUR;
      const observations: UsageObservationPoint[] = [
        { checkedAt: pastMondayNoon, usedPercent: 20, resetsAt: "2026-10-05T19:00:00Z" },
        { checkedAt: pastMondayNoon + 1 * HOUR, usedPercent: 45, resetsAt: "2026-10-05T19:00:00Z" },
        { checkedAt: pastMondayNoon + 2 * HOUR, usedPercent: 70, resetsAt: "2026-10-05T19:00:00Z" },
      ];

      // Account is only at 30% with 3 hours left
      const win: ServerProviderUsageWindow = {
        id: "session",
        kind: "session",
        label: "Session",
        usedPercent: 30,
        windowDurationMins: 300,
        resetsAt: DateTime.formatIso(DateTime.makeUnsafe(mondayNoon + 3 * HOUR)),
      };

      const forecast = forecastWindowUsedPercentAtReset(win, mondayNoon, observations);
      expect(forecast).not.toBeNull();
      // Naive pace predicts 75%, but historical peak hours elevate forecast above 85%
      expect(forecast!).toBeGreaterThanOrEqual(85);
    });
  });
});
