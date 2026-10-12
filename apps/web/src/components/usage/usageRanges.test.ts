import { describe, expect, it } from "vite-plus/test";

import { makeRangeWindow, rangeById, rangeIdForDays } from "./usageRanges";

const NOW = new Date("2026-10-11T20:07:30Z");

describe("makeRangeWindow", () => {
  it("builds a minute-bucketed rolling window for short ranges", () => {
    const window = makeRangeWindow("15m", NOW);
    expect(window.resolution).toBe("hour");
    expect(Date.parse(window.untilTime!) - Date.parse(window.sinceTime!)).toBe(15 * 60_000);
    expect(window.bucketMinutes).toBe(1);
  });

  it("keeps the 24 hour window on hourly buckets", () => {
    const window = makeRangeWindow("24h", NOW);
    expect(Date.parse(window.untilTime!) - Date.parse(window.sinceTime!)).toBe(24 * 3_600_000);
    expect(window.bucketMinutes).toBeUndefined();
  });

  it("builds whole-day windows for long ranges", () => {
    const window = makeRangeWindow("7d", NOW);
    expect(window.resolution).toBe("day");
    expect(window.bucketMinutes).toBeUndefined();
  });

  it("never exceeds the server's 24 hour hourly cap or 100 buckets", () => {
    for (const id of ["15m", "30m", "1h", "3h", "6h", "12h", "24h"] as const) {
      const range = rangeById(id);
      if (!("minutes" in range)) throw new Error("expected an hourly range");
      expect(range.minutes).toBeLessThanOrEqual(1440);
      expect(range.minutes / range.bucketMinutes).toBeLessThanOrEqual(100);
    }
  });

  it("maps the retired day counts onto ranges", () => {
    expect([1, 7, 30, 90].map(rangeIdForDays)).toEqual(["24h", "7d", "30d", "90d"]);
  });
});
