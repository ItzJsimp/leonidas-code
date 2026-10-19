// @effect-diagnostics nodeBuiltinImport:off - reads two files from the AIOS folder synchronously, like aiosHome.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { isRealPathInside } from "./aiosCards.ts";

import type {
  AiosDirection,
  AiosDirectionCard,
  AiosDirectionGoal,
  AiosDirectionHorizon,
  AiosDirectionHorizonKey,
  TaskBoardTask,
} from "@t3tools/contracts";

const DAY_MS = 86_400_000;
const STALE_AFTER_DAYS = 7;
const MAX_CARDS_PER_HORIZON = 5;
const WEEK_BLOCK = /<!-- week:start -->\r?\n([\s\S]*?)\r?\n?<!-- week:end -->/;
const WEEK_DATE = /Week of (\d{4}-\d{2}-\d{2})/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const HORIZONS: ReadonlyArray<{
  readonly key: AiosDirectionHorizonKey;
  readonly title: string;
  readonly heading: RegExp;
  /** A card due within this many days (and not before the previous horizon) belongs here. */
  readonly withinDays: number | null;
}> = [
  { key: "week", title: "Week", heading: /^week$/i, withinDays: 7 },
  { key: "month", title: "Month", heading: /^month$/i, withinDays: 31 },
  { key: "sixMonths", title: "6 Months", heading: /^6 months$/i, withinDays: 183 },
  { key: "year", title: "1 Year", heading: /^1 year$/i, withinDays: 366 },
  { key: "life", title: "Life", heading: /^life$/i, withinDays: null },
];

const PRIORITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 } as const;

const plain = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .trim();

const dayNumber = (isoDate: string): number | null => {
  if (!ISO_DATE.test(isoDate)) return null;
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / DAY_MS);
};

const readInside = (root: string, relative: string): string | null => {
  const file = NodePath.join(root, relative);
  if (!isRealPathInside(root, file)) return null;
  try {
    return NodeFS.readFileSync(file, "utf8").replace(/^﻿/, "");
  } catch {
    return null;
  }
};

/** The rows of the first table in goals.md whose first column is a goal id like G0. */
export function parseGoals(text: string): ReadonlyArray<AiosDirectionGoal> {
  const goals: AiosDirectionGoal[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => plain(cell));
    const id = cells[0] ?? "";
    if (!/^G\d+$/.test(id) || cells.length < 5) continue;
    goals.push({
      id,
      goal: cells[1] ?? "",
      measuredBy: cells[2] ?? "",
      targetDate: cells[3] ?? "",
      status: cells.slice(4).join(" | "),
    });
  }
  return goals;
}

const bulletsOf = (lines: ReadonlyArray<string>): string[] =>
  lines
    .map((line) => /^\s*[-*]\s+(.*)$/.exec(line)?.[1])
    .filter((item): item is string => item !== undefined)
    .map(plain)
    .filter((item) => item.length > 0);

/** Splits horizons.md into the 5 horizons; a horizon the file lacks comes back empty. */
export function parseHorizons(text: string): {
  readonly horizons: ReadonlyArray<Omit<AiosDirectionHorizon, "cards">>;
  readonly weekHeading: string | null;
  readonly weekDate: string | null;
} {
  const week = WEEK_BLOCK.exec(text)?.[1] ?? null;
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  let inWeekBlock = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.includes("<!-- week:start -->")) inWeekBlock = true;
    if (!inWeekBlock) {
      const heading = /^##\s+(.+?)\s*$/.exec(line)?.[1];
      if (heading !== undefined) {
        current = heading;
        sections.set(current, []);
        continue;
      }
      if (current !== null) sections.get(current)?.push(line);
      continue;
    }
    if (line.includes("<!-- week:end -->")) inWeekBlock = false;
  }
  const weekLines = week === null ? null : week.split(/\r?\n/);
  const weekHeading =
    weekLines?.map((line) => plain(line)).find((line) => WEEK_DATE.test(line)) ?? null;
  const horizons = HORIZONS.map(({ key, title, heading }) => {
    const found = [...sections.entries()].find(([name]) => heading.test(name.trim()));
    const lines = key === "week" ? (weekLines ?? found?.[1] ?? []) : (found?.[1] ?? []);
    const range = lines
      .map((line) => /^(To \d{4}-\d{2}-\d{2}):/.exec(line.trim())?.[1])
      .find(Boolean);
    return { key, title, range: range ?? null, items: bulletsOf(lines) };
  });
  return {
    horizons,
    weekHeading,
    weekDate: week === null ? null : (WEEK_DATE.exec(week)?.[1] ?? null),
  };
}

/** Open Critical or High cards, placed by status (week) or by due date; ordered by priority. */
export function placeTopCards(
  tasks: ReadonlyArray<TaskBoardTask>,
  nowMs: number,
): Record<AiosDirectionHorizonKey, AiosDirectionCard[]> {
  const placed: Record<AiosDirectionHorizonKey, AiosDirectionCard[]> = {
    week: [],
    month: [],
    sixMonths: [],
    year: [],
    life: [],
  };
  const today = Math.floor(nowMs / DAY_MS);
  const ranked = tasks
    .filter(
      (task) =>
        task.status !== "done" &&
        (task.priority === "critical" || task.priority === "high") &&
        task.kind !== "agent_run",
    )
    .toSorted(
      (a, b) =>
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
        (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
        b.updatedAt - a.updatedAt,
    );
  for (const task of ranked) {
    const dueDay = task.due ? dayNumber(task.due) : null;
    let key: AiosDirectionHorizonKey | null = null;
    if (task.status === "in_progress" || task.status === "review") key = "week";
    else if (dueDay !== null) {
      const days = dueDay - today;
      key = HORIZONS.find((h) => h.withinDays !== null && days <= h.withinDays)?.key ?? "year";
    }
    if (key === null || placed[key].length >= MAX_CARDS_PER_HORIZON) continue;
    placed[key].push({
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      due: task.due ?? null,
    });
  }
  return placed;
}

export function buildDirection(
  root: string | null,
  goalsText: string | null,
  horizonsText: string | null,
  tasks: ReadonlyArray<TaskBoardTask>,
  nowMs: number,
): AiosDirection {
  const parsed = parseHorizons(horizonsText ?? "");
  const cards = placeTopCards(tasks, nowMs);
  const weekDay = parsed.weekDate === null ? null : dayNumber(parsed.weekDate);
  const weekAgeDays = weekDay === null ? null : Math.floor(nowMs / DAY_MS) - weekDay;
  return {
    root,
    goals: goalsText === null ? [] : parseGoals(goalsText),
    horizons: parsed.horizons.map((horizon) => ({ ...horizon, cards: cards[horizon.key] })),
    weekHeading: parsed.weekHeading,
    weekDate: parsed.weekDate,
    weekAgeDays,
    // A missing date is stale: nobody can tell how old the plan is.
    weekStale: weekAgeDays === null || weekAgeDays > STALE_AFTER_DAYS,
  };
}

export function readDirection(
  root: string,
  tasks: ReadonlyArray<TaskBoardTask>,
  nowMs: number,
): AiosDirection {
  return buildDirection(
    root,
    readInside(root, "ideal-state/goals.md"),
    readInside(root, "ideal-state/horizons.md"),
    tasks,
    nowMs,
  );
}

/** True when there is nothing to show: no goals and no horizon items. */
export const isDirectionEmpty = (direction: AiosDirection): boolean =>
  direction.goals.length === 0 && direction.horizons.every((h) => h.items.length === 0);
