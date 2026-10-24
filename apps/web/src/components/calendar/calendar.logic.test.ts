import type { CalendarEvent } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  addDays,
  dayLabel,
  eventsOnDay,
  startOfDay,
  timeLabel,
  todayCountLabel,
  upcomingEvents,
} from "./calendar.logic";

const at = (y: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(y, m - 1, d, h, mi).getTime();
const ev = (title: string, start: number, end: number, allDay = false): CalendarEvent => ({
  id: title,
  sourceId: "s",
  title,
  start: new Date(start).toISOString(),
  end: new Date(end).toISOString(),
  allDay,
});

const NOW = at(2026, 3, 10, 12, 0);

describe("calendar logic", () => {
  it("finds local day bounds", () => {
    expect(startOfDay(NOW)).toBe(at(2026, 3, 10));
    expect(addDays(NOW, 1)).toBe(at(2026, 3, 11));
  });

  it("lists today's events in time order, all-day first, and keeps events that cross midnight", () => {
    const events = [
      ev("Lunch", at(2026, 3, 10, 12), at(2026, 3, 10, 13)),
      ev("Standup", at(2026, 3, 10, 9), at(2026, 3, 10, 9, 15)),
      ev("Holiday", at(2026, 3, 10), at(2026, 3, 11), true),
      ev("Tomorrow", at(2026, 3, 11, 9), at(2026, 3, 11, 10)),
      ev("Yesterday", at(2026, 3, 9, 9), at(2026, 3, 9, 10)),
      ev("Late shift", at(2026, 3, 9, 22), at(2026, 3, 10, 2)),
    ];
    expect(eventsOnDay(events, NOW).map((e) => e.title)).toEqual([
      "Holiday",
      "Late shift",
      "Standup",
      "Lunch",
    ]);
  });

  it("takes the next events that have not ended", () => {
    const events = [
      ev("Over", at(2026, 3, 10, 8), at(2026, 3, 10, 9)),
      ev("Now", at(2026, 3, 10, 11), at(2026, 3, 10, 13)),
      ev("B", at(2026, 3, 12, 9), at(2026, 3, 12, 10)),
      ev("A", at(2026, 3, 11, 9), at(2026, 3, 11, 10)),
    ];
    expect(upcomingEvents(events, NOW, 2).map((e) => e.title)).toEqual(["Now", "A"]);
  });

  it("words the labels and the count", () => {
    const today = ev("T", at(2026, 3, 10, 15, 30), at(2026, 3, 10, 16));
    expect(timeLabel(today)).toBe("3:30 PM");
    expect(timeLabel(ev("D", at(2026, 3, 10), at(2026, 3, 11), true))).toBe("All day");
    expect(dayLabel(today, NOW)).toBe("Today");
    expect(dayLabel(ev("N", at(2026, 3, 11, 9), at(2026, 3, 11, 10)), NOW)).toBe("Tomorrow");
    expect(dayLabel(ev("W", at(2026, 3, 13, 9), at(2026, 3, 13, 10)), NOW)).toBe("Fri");
    expect(todayCountLabel([], NOW)).toBeUndefined();
    expect(todayCountLabel([today], NOW)).toBe("1 today");
    expect(todayCountLabel([today, today], NOW)).toBe("2 today");
  });
});
