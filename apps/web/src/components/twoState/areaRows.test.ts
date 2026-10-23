import { describe, expect, it } from "vite-plus/test";

import { areaRow, changedLabel } from "./areaRows";

const now = new Date(2026, 9, 21, 21, 0).getTime();
const minutes = (count: number) => now - count * 60_000;

describe("changedLabel", () => {
  it("uses plain words for recent changes", () => {
    expect(changedLabel(now - 20_000, now)).toBe("just now");
    expect(changedLabel(minutes(1), now)).toBe("1 min ago");
    expect(changedLabel(minutes(12), now)).toBe("12 min ago");
    expect(changedLabel(minutes(60), now)).toBe("1 h ago");
    expect(changedLabel(minutes(179), now)).toBe("2 h ago");
  });

  it("shows the clock time earlier today, then Yesterday, days and a date", () => {
    expect(changedLabel(new Date(2026, 9, 21, 3, 0).getTime(), now)).toBe("3:00 AM");
    expect(changedLabel(new Date(2026, 9, 20, 23, 0).getTime(), now)).toBe("Yesterday");
    expect(changedLabel(new Date(2026, 9, 18, 12, 0).getTime(), now)).toBe("3 days ago");
    expect(changedLabel(new Date(2026, 8, 2, 12, 0).getTime(), now)).toBe("Sep 2");
  });

  it("treats a future time from clock drift as just now", () => {
    expect(changedLabel(now + 5_000, now)).toBe("just now");
  });
});

describe("areaRow", () => {
  it("names the area and counts its units with the right word", () => {
    expect(areaRow({ id: "tasks", units: 118, changedAt: minutes(12) }, now)).toEqual({
      id: "tasks",
      label: "Task cards",
      detail: "118 cards · 12 min ago",
    });
    expect(areaRow({ id: "memory", units: 1, changedAt: minutes(2) }, now).detail).toBe(
      "1 note · 2 min ago",
    );
  });

  it("says updated just now for a change in the last minute", () => {
    expect(areaRow({ id: "tasks", units: 2, changedAt: now - 5_000 }, now).detail).toBe(
      "2 cards · updated just now",
    );
  });

  it("falls back to files for an area it does not know", () => {
    expect(areaRow({ id: "recipes", units: 4, changedAt: minutes(5) }, now)).toEqual({
      id: "recipes",
      label: "Recipes",
      detail: "4 files · 5 min ago",
    });
  });
});
