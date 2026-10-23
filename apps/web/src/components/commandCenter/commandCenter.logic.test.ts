import { describe, expect, it } from "vite-plus/test";

import {
  areaBars,
  doneSeries,
  eventsToday,
  goalPercent,
  oldestAt,
  ringPercent,
  statusSegments,
  summaryItems,
  tileModels,
  updatedLabel,
} from "./commandCenter.logic";

const now = new Date(2026, 9, 22, 20, 5).getTime();
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const counts = { todo: 14, inProgress: 6, review: 8, blocked: 3 };
const areas = [
  { id: "tasks", units: 118, changedAt: 1 },
  { id: "logs", units: 230, changedAt: 1 },
];

const tile = (id: string, input: Partial<Parameters<typeof tileModels>[0]> = {}) =>
  tileModels(
    { needsYou: 3, running: 2, oldestNeedsYouAt: null, home: { counts, areas }, ...input },
    now,
  ).find((entry) => entry.id === id)!;

describe("tileModels", () => {
  it("gives four tiles with the numbers the page already shows", () => {
    const tiles = tileModels(
      { needsYou: 3, running: 2, oldestNeedsYouAt: at(21, 21, 14), home: { counts, areas } },
      now,
    );
    expect(tiles.map((entry) => [entry.label, entry.value, entry.unit])).toEqual([
      ["Needs you", 3, "items"],
      ["Running", 2, "agents"],
      ["Open tasks", 31, "tasks"],
      ["Memory", 348, "items"],
    ]);
  });

  it("describes the oldest waiting item instead of inventing a trend", () => {
    expect(tile("needs-you", { oldestNeedsYouAt: at(22, 9, 14) }).note).toBe(
      "Oldest waits since 9:14 AM",
    );
    expect(tile("needs-you", { oldestNeedsYouAt: at(21, 21, 14) }).note).toBe(
      "Oldest waits since yesterday",
    );
    expect(tile("needs-you", { oldestNeedsYouAt: at(18, 9, 14) }).note).toBe(
      "Oldest waits since Oct 18",
    );
    expect(tile("needs-you", { needsYou: 0 }).note).toBe("Nothing is waiting for you");
  });

  it("uses singular units for one", () => {
    expect(tile("needs-you", { needsYou: 1 }).unit).toBe("item");
    expect(tile("running", { running: 1 }).unit).toBe("agent");
    expect(tile("running", { running: 0 }).note).toBe("No agent is working now");
  });

  it("has no number while the AIOS read is loading", () => {
    const loading = { home: null };
    expect(tile("open-tasks", loading).value).toBeNull();
    expect(tile("memory", loading).value).toBeNull();
    expect(tile("needs-you", loading).value).toBe(3);
  });

  it("says when no AIOS folder is connected", () => {
    const empty = tile("memory", { home: { counts, areas: [] } });
    expect(empty.value).toBe(0);
    expect(empty.note).toBe("No AIOS folder connected yet");
  });

  it("names blocked tasks only when there are some", () => {
    expect(tile("open-tasks").note).toBe("6 in progress · 3 blocked");
    expect(tile("open-tasks", { home: { counts: { ...counts, blocked: 0 }, areas } }).note).toBe(
      "6 in progress",
    );
  });

  it("explains exactly what each number counts", () => {
    for (const entry of tileModels(
      { needsYou: 0, running: 0, oldestNeedsYouAt: null, home: null },
      now,
    )) {
      expect(entry.tip.length).toBeGreaterThan(20);
    }
  });
});

describe("statusSegments", () => {
  it("sizes each status by its share and keeps the order", () => {
    const { total, segments } = statusSegments(counts);
    expect(total).toBe(31);
    expect(segments.map((segment) => [segment.label, segment.value])).toEqual([
      ["In progress", 6],
      ["To do", 14],
      ["In review", 8],
      ["Blocked", 3],
    ]);
    expect(segments[0]!.percent).toBeCloseTo(19.35, 1);
  });

  it("returns no segments for zero tasks", () => {
    expect(statusSegments({ todo: 0, inProgress: 0, review: 0, blocked: 0 })).toEqual({
      total: 0,
      segments: [],
      legend: [
        { key: "inProgress", label: "In progress", value: 0, tone: "foreground" },
        { key: "todo", label: "To do", value: 0, tone: "muted" },
        { key: "review", label: "In review", value: 0, tone: "info" },
        { key: "blocked", label: "Blocked", value: 0, tone: "warning" },
      ],
    });
  });

  it("drops a status with no tasks from the bar but keeps it in the legend", () => {
    const { segments, legend } = statusSegments({ ...counts, blocked: 0 });
    expect(segments.map((segment) => segment.label)).not.toContain("Blocked");
    expect(legend.map((row) => row.label)).toContain("Blocked");
  });
});

describe("ringPercent", () => {
  it("is a whole percent", () => {
    expect(ringPercent(2, 5)).toBe(40);
    expect(ringPercent(5, 5)).toBe(100);
  });
  it("is null for no tasks, never NaN", () => {
    expect(ringPercent(0, 0)).toBeNull();
  });
  it("never goes past 100", () => {
    expect(ringPercent(7, 5)).toBe(100);
  });
});

describe("areaBars", () => {
  it("sorts by size and scales to the biggest", () => {
    const { total, bars } = areaBars([...areas, { id: "wiki", units: 35, changedAt: 1 }]);
    expect(total).toBe(383);
    expect(bars.map((bar) => [bar.label, bar.units])).toEqual([
      ["Logs", 230],
      ["Tasks", 118],
      ["Wiki", 35],
    ]);
    expect(bars[0]!.widthPercent).toBe(100);
    expect(bars[2]!.widthPercent).toBeCloseTo(15.2, 1);
  });
  it("handles no areas and areas with no units", () => {
    expect(areaBars([])).toEqual({ total: 0, bars: [] });
    expect(areaBars([{ id: "tasks", units: 0, changedAt: 0 }]).bars[0]!.widthPercent).toBe(0);
  });
});

describe("doneSeries", () => {
  const task = (completedAt: number | null, extra: object = {}) => ({
    status: "done" as const,
    completedAt,
    ...extra,
  });

  it("counts finished tasks per local day for 14 days, today last", () => {
    const series = doneSeries(
      [task(at(22, 8)), task(at(22, 19)), task(at(21)), task(at(9, 1)), task(at(8, 23))],
      now,
    );
    expect(series.days).toHaveLength(14);
    expect(series.days.at(-1)).toMatchObject({ label: "22", count: 2, today: true });
    expect(series.days[0]).toMatchObject({ label: "9", count: 1, today: false });
    expect(series.total).toBe(4);
    expect(series.today).toBe(2);
    expect(series.average).toBe(0.3);
  });

  it("ignores open tasks, tasks with no date and agent run records", () => {
    const series = doneSeries(
      [
        { status: "todo" as const, completedAt: at(22) },
        task(null),
        task(at(22), { kind: "agent_run" }),
      ],
      now,
    );
    expect(series.total).toBe(0);
  });

  it("compares the last 7 days with the 7 before in words", () => {
    const series = doneSeries(
      [task(at(22)), task(at(21)), task(at(20)), task(at(12)), task(at(11))],
      now,
    );
    expect(series.week).toBe(3);
    expect(series.weekBefore).toBe(2);
    expect(series.change).toBe("1 more than the 7 days before");
    expect(doneSeries([task(at(22)), task(at(14))], now).change).toBe("Same as the 7 days before");
    expect(doneSeries([task(at(14)), task(at(13))], now).change).toBe(
      "2 fewer than the 7 days before",
    );
  });
});

describe("updatedLabel", () => {
  it("says just now, minutes, then the clock", () => {
    expect(updatedLabel(now - 10_000, now)).toBe("Updated just now");
    expect(updatedLabel(now - 60_000, now)).toBe("Updated 1 min ago");
    expect(updatedLabel(at(22, 8, 0), now)).toBe("Updated 8:00 AM");
  });
  it("says so when nothing was read yet", () => {
    expect(updatedLabel(0, now)).toBe("Not read yet");
  });
});

describe("goalPercent", () => {
  it("reads a percent the status already states", () => {
    expect(goalPercent("62% done")).toBe(62);
    expect(goalPercent("18 of 29 cards done")).toBe(62);
  });
  it("returns null when the text holds no honest percent", () => {
    expect(goalPercent("Not started")).toBeNull();
    expect(goalPercent("")).toBeNull();
    expect(goalPercent("0 of 0")).toBeNull();
  });
});

describe("feed helpers", () => {
  const event = (ts: string) => ({ ts }) as never;
  it("counts events of the local day", () => {
    const today = new Date(2026, 9, 22, 9).toISOString();
    const yesterday = new Date(2026, 9, 21, 23).toISOString();
    expect(eventsToday([event(today), event(today), event(yesterday)], now)).toBe(2);
  });
  it("finds the oldest event time", () => {
    expect(oldestAt([])).toBeNull();
    const a = new Date(2026, 9, 22, 9).toISOString();
    const b = new Date(2026, 9, 21, 9).toISOString();
    expect(oldestAt([event(a), event(b)])).toBe(Date.parse(b));
  });
});

describe("summaryItems", () => {
  const line = (counts: Parameters<typeof summaryItems>[0]) =>
    summaryItems(counts)
      .map((item) => item.lead + item.rest)
      .join(" · ");
  it("reads like the line under the greeting", () => {
    expect(line({ needsYou: 3, running: 2, today: { done: 2, total: 5 } })).toBe(
      "3 need you · 2 agents running · 2 of 5 done today",
    );
  });
  it("uses plain words for one and for none", () => {
    expect(line({ needsYou: 1, running: 1, today: null })).toBe("1 needs you · 1 agent running");
    expect(line({ needsYou: 0, running: 0, today: { done: 0, total: 0 } })).toBe(
      "Nothing needs you · No agents running",
    );
  });
});
