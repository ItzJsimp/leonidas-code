// @effect-diagnostics nodeBuiltinImport:off - temp AIOS folders are plain Node fixtures.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { TaskBoardTask } from "@t3tools/contracts";
import { DateTime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";

import {
  buildDirection,
  isDirectionEmpty,
  parseGoals,
  parseHorizons,
  placeTopCards,
  readDirection,
} from "./aiosDirection.ts";

const GOALS = `# Goals

| ID | Goal | Measured by | Target date | Status |
|---|---|---|---|---|
| **G0** | Grow SimplyGersi to $5K/month | Monthly revenue | 2027-03-31 | Restarting; see [\`income.md\`](../income.md) |
| **G8** | Sell Leonidas | MRR | 2027-01-31 | In progress |
`;

const HORIZONS = `# Horizons

## Week

<!-- week:start -->
**Week of 2026-10-17 to 2026-10-24 (APPROVED)**

- **Sat 10-17:** Play the game.
- **Sun 10-18:** Restart call.
<!-- week:end -->

## Month

To 2026-11-17:

- **G8:** Leonidas 1.0 ships.

## 6 Months

To 2027-04-17:

- **G0:** $3,000 in December.

## 1 Year

To 2027-10-17:

- **G8:** Past $1,000 MRR.

## Life

Direction beyond any goal.
- Health has no goals yet.
`;

const DAY = 86_400_000;
const at = (isoDate: string) => Date.parse(`${isoDate}T12:00:00Z`);

const task = (id: string, extra: Partial<TaskBoardTask> = {}): TaskBoardTask =>
  ({
    id,
    project: "p",
    title: `Task ${id}`,
    description: "",
    status: "todo",
    priority: "high",
    claimedBy: null,
    claimedAt: null,
    claimedAgent: null,
    completedBy: null,
    completedAt: null,
    completionSummary: null,
    createdAt: 0,
    updatedAt: 0,
    labels: [],
    source: "aios_card",
    sourceId: id,
    sourceFile: `${id}.md`,
    ...extra,
  }) as TaskBoardTask;

describe("parseGoals", () => {
  it("reads every goal row and strips Markdown", () => {
    const goals = parseGoals(GOALS);
    expect(goals.map((goal) => goal.id)).toEqual(["G0", "G8"]);
    expect(goals[0]?.targetDate).toBe("2027-03-31");
    expect(goals[0]?.status).toBe("Restarting; see income.md");
  });

  it("returns nothing for text without a goal table", () => {
    expect(parseGoals("# Goals\n\nNone yet.")).toEqual([]);
  });
});

describe("parseHorizons", () => {
  it("returns all 5 horizons with items and ranges", () => {
    const parsed = parseHorizons(HORIZONS);
    expect(parsed.horizons.map((horizon) => horizon.key)).toEqual([
      "week",
      "month",
      "sixMonths",
      "year",
      "life",
    ]);
    expect(parsed.horizons[0]?.items).toHaveLength(2);
    expect(parsed.horizons[1]).toMatchObject({
      range: "To 2026-11-17",
      items: ["G8: Leonidas 1.0 ships."],
    });
    expect(parsed.horizons[4]?.items).toEqual(["Health has no goals yet."]);
    expect(parsed.weekDate).toBe("2026-10-17");
  });

  it("returns 5 empty horizons for an empty file", () => {
    const parsed = parseHorizons("");
    expect(parsed.horizons).toHaveLength(5);
    expect(parsed.weekDate).toBeNull();
  });
});

describe("week stale flag", () => {
  const build = (nowIso: string) => buildDirection("/r", GOALS, HORIZONS, [], at(nowIso));

  it("is fresh at 7 days old", () => {
    const direction = build("2026-10-24");
    expect(direction.weekAgeDays).toBe(7);
    expect(direction.weekStale).toBe(false);
  });

  it("is stale at 8 days old", () => {
    const direction = build("2026-10-25");
    expect(direction.weekAgeDays).toBe(8);
    expect(direction.weekStale).toBe(true);
  });

  it("is stale when the week block has no date", () => {
    const direction = buildDirection("/r", GOALS, "## Week\n\n- a\n", [], at("2026-10-17"));
    expect(direction.weekStale).toBe(true);
    expect(direction.weekAgeDays).toBeNull();
  });
});

describe("placeTopCards", () => {
  const now = at("2026-10-17");
  const iso = (days: number) =>
    DateTime.formatIso(DateTime.makeUnsafe(now + days * DAY)).slice(0, 10);

  it("places open Critical and High cards by status and due date", () => {
    const placed = placeTopCards(
      [
        task("a", { status: "in_progress" }),
        task("b", { due: iso(20) }),
        task("c", { due: iso(100) }),
        task("d", { due: iso(300) }),
        task("e", { due: iso(2), status: "done" }),
        task("f", { priority: "medium", due: iso(2) }),
        task("g"),
      ],
      now,
    );
    expect(placed.week.map((card) => card.taskId)).toEqual(["a"]);
    expect(placed.month.map((card) => card.taskId)).toEqual(["b"]);
    expect(placed.sixMonths.map((card) => card.taskId)).toEqual(["c"]);
    expect(placed.year.map((card) => card.taskId)).toEqual(["d"]);
    expect(placed.life).toEqual([]);
  });

  it("keeps at most 5 cards per horizon, Critical first", () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      task(`t${i}`, { status: "in_progress", priority: i === 6 ? "critical" : "high" }),
    );
    const week = placeTopCards(many, now).week;
    expect(week).toHaveLength(5);
    expect(week[0]?.taskId).toBe("t6");
  });
});

describe("readDirection", () => {
  let root: string;
  let outside: string;

  beforeEach(() => {
    root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "direction-"));
    outside = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "direction-out-"));
  });
  afterEach(() => {
    NodeFS.rmSync(root, { recursive: true, force: true });
    NodeFS.rmSync(outside, { recursive: true, force: true });
  });

  it("reads both files from the workspace root", () => {
    NodeFS.mkdirSync(NodePath.join(root, "ideal-state"));
    NodeFS.writeFileSync(NodePath.join(root, "ideal-state", "goals.md"), GOALS);
    NodeFS.writeFileSync(NodePath.join(root, "ideal-state", "horizons.md"), HORIZONS);
    const direction = readDirection(root, [], at("2026-10-18"));
    expect(direction.goals).toHaveLength(2);
    expect(direction.horizons).toHaveLength(5);
    expect(isDirectionEmpty(direction)).toBe(false);
  });

  it("is empty for a fresh AIOS with no ideal-state folder", () => {
    const direction = readDirection(root, [], at("2026-10-18"));
    expect(direction.goals).toEqual([]);
    expect(direction.horizons).toHaveLength(5);
    expect(isDirectionEmpty(direction)).toBe(true);
    expect(direction.weekStale).toBe(true);
  });

  it("ignores an ideal-state folder linked in from outside the root", () => {
    NodeFS.writeFileSync(NodePath.join(outside, "goals.md"), GOALS);
    NodeFS.writeFileSync(NodePath.join(outside, "horizons.md"), HORIZONS);
    try {
      NodeFS.symlinkSync(outside, NodePath.join(root, "ideal-state"), "junction");
    } catch {
      return;
    }
    const direction = readDirection(root, [], at("2026-10-18"));
    expect(direction.goals).toEqual([]);
    expect(isDirectionEmpty(direction)).toBe(true);
  });
});
