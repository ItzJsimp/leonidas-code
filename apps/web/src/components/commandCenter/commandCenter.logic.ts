import type { FoldedFeedEvent, TaskBoardHomeArea } from "@t3tools/contracts";

import { areaLabel, changedLabel } from "../twoState/areaRows";

const DAY = 24 * 60 * 60_000;
const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export interface TaskCounts {
  readonly todo: number;
  readonly inProgress: number;
  readonly review: number;
  readonly blocked: number;
}

export interface HomeInput {
  readonly counts: TaskCounts;
  readonly areas?: ReadonlyArray<TaskBoardHomeArea> | undefined;
}

export interface TileModel {
  readonly id: "needs-you" | "running" | "open-tasks" | "memory";
  readonly label: string;
  /** Null while the number is still loading. */
  readonly value: number | null;
  readonly unit: string;
  /** One plain muted line. It never claims a trend, because the app keeps no history yet. */
  readonly note: string;
  /** Says exactly what the number counts. */
  readonly tip: string;
}

/** "9:14 AM" today, "yesterday", else "Oct 18". */
function sinceLabel(at: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) {
    return new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (days === 1) return "yesterday";
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function tileModels(
  input: {
    readonly needsYou: number | null;
    readonly running: number | null;
    /** Chats that are not archived. Undefined when the caller does not count them. */
    readonly openChats?: number | null;
    readonly oldestNeedsYouAt: number | null;
    readonly home: HomeInput | null;
  },
  now: number,
): TileModel[] {
  const { needsYou, running, oldestNeedsYouAt, home } = input;
  const openChats =
    input.openChats === undefined || input.openChats === null
      ? ""
      : ` · ${input.openChats.toLocaleString("en-US")} open ${plural(input.openChats, "chat", "chats")}`;
  const open = home
    ? home.counts.todo + home.counts.inProgress + home.counts.review + home.counts.blocked
    : null;
  const memory = home ? (home.areas ?? []).reduce((sum, area) => sum + area.units, 0) : null;
  const areaCount = home?.areas?.length ?? 0;
  return [
    {
      id: "needs-you",
      label: "Needs you",
      value: needsYou,
      unit: plural(needsYou ?? 0, "item", "items"),
      note:
        needsYou === null
          ? "Reading your notifications"
          : needsYou === 0
            ? "Nothing is waiting for you"
            : oldestNeedsYouAt === null
              ? "Waiting for your answer"
              : `Oldest waits since ${sinceLabel(oldestNeedsYouAt, now)}`,
      tip: "Unread questions, permission requests and failures. The Notifications badge shows the same number.",
    },
    {
      id: "running",
      label: "Running",
      value: running,
      unit: plural(running ?? 0, "agent", "agents"),
      note:
        running === null
          ? "Reading your chats"
          : running === 0
            ? `No agent is working now${openChats}`
            : `Working right now${openChats}`,
      tip: "Chats with an agent working now, or waiting for background work it started. Open chats are chats you have not archived.",
    },
    {
      id: "open-tasks",
      label: "Open tasks",
      value: open,
      unit: plural(open ?? 0, "task", "tasks"),
      note: home
        ? [
            `${home.counts.inProgress.toLocaleString("en-US")} in progress`,
            ...(home.counts.blocked > 0
              ? [`${home.counts.blocked.toLocaleString("en-US")} blocked`]
              : []),
          ].join(" · ")
        : "Reading your task cards",
      tip: "Task cards that are To do, In progress, In review or Blocked.",
    },
    {
      id: "memory",
      label: "Memory",
      value: memory,
      unit: plural(memory ?? 0, "item", "items"),
      note: !home
        ? "Reading your AIOS folder"
        : areaCount === 0
          ? "No AIOS folder connected yet"
          : `Across ${areaCount} ${plural(areaCount, "area", "areas")}`,
      tip: "Cards, notes, decisions, logs, skills and pages in your AIOS folder, added up across every area.",
    },
  ];
}

export type SegmentTone = "foreground" | "muted" | "info" | "warning";

export interface StatusRow {
  readonly key: keyof TaskCounts;
  readonly label: string;
  readonly value: number;
  readonly tone: SegmentTone;
}

const STATUS_ROWS: ReadonlyArray<Pick<StatusRow, "key" | "label" | "tone">> = [
  { key: "inProgress", label: "In progress", tone: "foreground" },
  { key: "todo", label: "To do", tone: "muted" },
  { key: "review", label: "In review", tone: "info" },
  { key: "blocked", label: "Blocked", tone: "warning" },
];

/** The bar holds the statuses that have tasks; the legend always lists all four. */
export function statusSegments(counts: TaskCounts): {
  readonly total: number;
  readonly segments: ReadonlyArray<StatusRow & { readonly percent: number }>;
  readonly legend: ReadonlyArray<StatusRow>;
} {
  const legend = STATUS_ROWS.map((row) => ({ ...row, value: counts[row.key] }));
  const total = legend.reduce((sum, row) => sum + row.value, 0);
  const segments =
    total === 0
      ? []
      : legend
          .filter((row) => row.value > 0)
          .map((row) => ({ ...row, percent: (row.value / total) * 100 }));
  return { total, segments, legend };
}

/** A whole percent from 0 to 100, or null when there is nothing to divide (no tasks). */
export function ringPercent(done: number, total: number): number | null {
  if (!(total > 0)) return null;
  return Math.round((Math.min(done, total) / total) * 100);
}

export interface AreaBar {
  readonly id: string;
  readonly label: string;
  readonly units: number;
  readonly widthPercent: number;
}

export function areaBars(areas: ReadonlyArray<TaskBoardHomeArea>): {
  readonly total: number;
  readonly bars: ReadonlyArray<AreaBar>;
} {
  const sorted = areas.toSorted(
    (a, b) => b.units - a.units || areaLabel(a.id).localeCompare(areaLabel(b.id)),
  );
  const max = sorted[0]?.units ?? 0;
  return {
    total: sorted.reduce((sum, area) => sum + area.units, 0),
    bars: sorted.map((area) => ({
      id: area.id,
      label: areaLabel(area.id),
      units: area.units,
      widthPercent: max > 0 ? (area.units / max) * 100 : 0,
    })),
  };
}

export interface DoneTask {
  readonly status: string;
  readonly completedAt: number | null;
  readonly kind?: string | undefined;
}

export interface DoneDay {
  readonly key: string;
  /** The day of the month, "22". */
  readonly label: string;
  /** "Thursday, October 22", for the tooltip. */
  readonly full: string;
  /** "Oct 9". */
  readonly short: string;
  readonly count: number;
  readonly today: boolean;
}

export interface DoneSeries {
  readonly days: ReadonlyArray<DoneDay>;
  readonly total: number;
  readonly today: number;
  /** Tasks finished per day over the 14 days, to one decimal. */
  readonly average: number;
  readonly week: number;
  readonly weekBefore: number;
  readonly change: string;
}

const DAYS_SHOWN = 14;

/** Finished tasks per local day. Agent run records are not tasks, so they stay out. */
export function doneSeries(tasks: ReadonlyArray<DoneTask>, now: number): DoneSeries {
  const todayStart = startOfDay(now);
  const counts = Array.from({ length: DAYS_SHOWN }, () => 0);
  for (const task of tasks) {
    if (task.status !== "done" || task.completedAt === null || task.kind === "agent_run") continue;
    const back = Math.round((todayStart - startOfDay(task.completedAt)) / DAY);
    if (back >= 0 && back < DAYS_SHOWN) counts[DAYS_SHOWN - 1 - back]! += 1;
  }
  const days = counts.map((count, index) => {
    const date = new Date(todayStart - (DAYS_SHOWN - 1 - index) * DAY);
    return {
      key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      label: String(date.getDate()),
      full: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      short: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
      today: index === DAYS_SHOWN - 1,
    };
  });
  const sum = (from: number, to: number) => counts.slice(from, to).reduce((a, b) => a + b, 0);
  const total = sum(0, DAYS_SHOWN);
  const week = sum(7, DAYS_SHOWN);
  const weekBefore = sum(0, 7);
  const gap = week - weekBefore;
  return {
    days,
    total,
    today: counts[DAYS_SHOWN - 1] ?? 0,
    average: Math.round((total / DAYS_SHOWN) * 10) / 10,
    week,
    weekBefore,
    change:
      gap === 0
        ? "Same as the 7 days before"
        : `${Math.abs(gap)} ${gap > 0 ? "more" : "fewer"} than the 7 days before`,
  };
}

/** The "Updated" chip text for the newest data read. */
export function updatedLabel(at: number, now: number): string {
  if (!(at > 0)) return "Not read yet";
  return `Updated ${changedLabel(at, now)}`;
}

/** A percent a goal's status text already states ("62%" or "18 of 29"). Null otherwise. */
export function goalPercent(status: string): number | null {
  const percent = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(status);
  if (percent) return Math.min(100, Math.round(Number(percent[1])));
  const of = /(\d+)\s+of\s+(\d+)/i.exec(status);
  return of ? ringPercent(Number(of[1]), Number(of[2])) : null;
}

export function eventsToday(events: ReadonlyArray<Pick<FoldedFeedEvent, "ts">>, now: number) {
  const start = startOfDay(now);
  return events.filter((event) => {
    const at = Date.parse(event.ts);
    return at >= start && at < start + DAY;
  }).length;
}

export function oldestAt(events: ReadonlyArray<Pick<FoldedFeedEvent, "ts">>): number | null {
  const times = events.map((event) => Date.parse(event.ts)).filter(Number.isFinite);
  return times.length === 0 ? null : Math.min(...times);
}

export interface SummaryItem {
  /** The number, shown bold. Empty when the sentence has none. */
  readonly lead: string;
  readonly rest: string;
}

/** "3 need you · 2 agents running · 2 of 5 done today", from the counts every page shares. */
export function summaryItems(counts: {
  readonly needsYou: number | null;
  readonly running: number | null;
  readonly today: { readonly done: number; readonly total: number } | null;
}): SummaryItem[] {
  const { needsYou, running, today } = counts;
  // Empty until both counts are read: the page shows a skeleton, never a false "Nothing needs you".
  if (needsYou === null || running === null) return [];
  return [
    needsYou === 0
      ? { lead: "", rest: "Nothing needs you" }
      : {
          lead: needsYou.toLocaleString("en-US"),
          rest: needsYou === 1 ? " needs you" : " need you",
        },
    running === 0
      ? { lead: "", rest: "No agents running" }
      : {
          lead: running.toLocaleString("en-US"),
          rest: ` ${plural(running, "agent", "agents")} running`,
        },
    ...(today === null || today.total === 0
      ? []
      : [{ lead: `${today.done} of ${today.total}`, rest: " done today" }]),
  ];
}

/** The first `max` rows of a list and how many were left out. */
export function capRows<T>(rows: readonly T[], max: number) {
  return { shown: rows.slice(0, max), hidden: Math.max(0, rows.length - max) };
}
