// @effect-diagnostics nodeBuiltinImport:off - temp AIOS folders are plain Node fixtures.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { TaskBoardTask } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";

import { buildHome, pickNextMove, readAreas, readBrief } from "./aiosHome.ts";

let root: string;

const task = (
  id: string,
  status: TaskBoardTask["status"],
  extra: Partial<TaskBoardTask> = {},
): TaskBoardTask =>
  ({
    id,
    project: "p",
    title: `Task ${id}`,
    description: "",
    status,
    priority: "medium",
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
    issueUrl: null,
    history: [],
    ...extra,
  }) as TaskBoardTask;

const writeBrief = (name: string, text: string) => {
  const dir = NodePath.join(root, "logs", "briefings");
  NodeFS.mkdirSync(dir, { recursive: true });
  NodeFS.writeFileSync(NodePath.join(dir, name), text);
};

beforeEach(() => {
  root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-home-"));
});

afterEach(() => {
  NodeFS.rmSync(root, { recursive: true, force: true });
});

describe("readBrief", () => {
  it("returns null for a blank AIOS folder", () => {
    expect(readBrief(root, [])).toBeNull();
  });

  it("reads the newest brief and marks a priority done when its linked card is done", () => {
    writeBrief("2026-10-01-briefing.md", "old");
    writeBrief(
      "2026-10-14-briefing.md",
      [
        "# Brief",
        "- **Priorities Seeded:**",
        "- [ ] **Ship it:** finish [the card](../../tasks/ship.md) today",
        "- [x] **Rest:** sleep by midnight",
        "- [ ] **Call:** phone the bank",
        "",
        "# Next",
      ].join("\n"),
    );
    const brief = readBrief(root, [task("ship", "done")]);
    expect(brief?.date).toBe("2026-10-14");
    expect(brief?.file).toBe("logs/briefings/2026-10-14-briefing.md");
    expect(brief?.priorities).toEqual([
      { title: "Ship it", detail: "finish the card today", done: true, taskId: "ship" },
      { title: "Rest", detail: "sleep by midnight", done: true, taskId: null },
      { title: "Call", detail: "phone the bank", done: false, taskId: null },
    ]);
  });

  it("ignores a briefings folder linked in from outside the AIOS", () => {
    const outside = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-outside-"));
    try {
      NodeFS.writeFileSync(NodePath.join(outside, "2026-10-14-briefing.md"), "# Brief\n");
      NodeFS.mkdirSync(NodePath.join(root, "logs"), { recursive: true });
      // A junction needs no admin rights on Windows and is a plain symlink elsewhere.
      NodeFS.symlinkSync(outside, NodePath.join(root, "logs", "briefings"), "junction");
      expect(readBrief(root, [])).toBeNull();
    } finally {
      NodeFS.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("pickNextMove", () => {
  it("prefers review, then work in progress, then blocked, then high-priority work", () => {
    const todo = task("t", "todo", { priority: "high" });
    const blocked = task("b", "blocked");
    const wip = task("w", "in_progress");
    const review = task("r", "review");
    expect(pickNextMove([todo, blocked, wip, review]).kind).toBe("review");
    expect(pickNextMove([todo, blocked, wip]).kind).toBe("finish");
    expect(pickNextMove([todo, blocked]).kind).toBe("unblock");
    expect(pickNextMove([todo])).toMatchObject({ kind: "focus", taskId: "t" });
  });

  it("picks the freshest task in progress and ranks critical above high", () => {
    const move = pickNextMove([
      task("old", "in_progress", { updatedAt: 1 }),
      task("new", "in_progress", { updatedAt: 2 }),
    ]);
    expect(move).toMatchObject({ kind: "finish", taskId: "new" });
    expect(move.reason).toContain("2 tasks in progress");
    expect(
      pickNextMove([
        task("h", "todo", { priority: "high", updatedAt: 9 }),
        task("c", "todo", { priority: "critical", updatedAt: 1 }),
      ]).taskId,
    ).toBe("c");
  });

  it("rests when only low-priority, done or parked work remains", () => {
    const move = pickNextMove([task("d", "done"), task("p", "parked"), task("l", "todo")]);
    expect(move).toMatchObject({ kind: "rest", taskId: null });
  });
});

describe("buildHome", () => {
  it("returns an empty Home when no AIOS is connected", () => {
    expect(buildHome(null, [])).toEqual({
      root: null,
      brief: null,
      areas: [],
      counts: { todo: 0, inProgress: 0, review: 0, blocked: 0 },
      move: expect.objectContaining({ kind: "rest" }),
    });
  });

  it("counts open work by status", () => {
    const home = buildHome(root, [
      task("a", "todo"),
      task("b", "todo"),
      task("c", "in_progress"),
      task("d", "blocked"),
      task("e", "done"),
    ]);
    expect(home.counts).toEqual({ todo: 2, inProgress: 1, review: 0, blocked: 1 });
  });
});

const writeAt = (relative: string, mtimeMs: number) => {
  const file = NodePath.join(root, relative);
  NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
  NodeFS.writeFileSync(file, "x");
  NodeFS.utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
};

describe("readAreas", () => {
  it("returns no areas for a missing root or a blank folder", async () => {
    expect(await readAreas(NodePath.join(root, "missing"))).toEqual([]);
    expect(await readAreas(root)).toEqual([]);
  });

  it("skips an area folder linked in from outside the AIOS", async () => {
    const outside = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-outside-"));
    try {
      NodeFS.writeFileSync(NodePath.join(outside, "page.md"), "x");
      NodeFS.symlinkSync(outside, NodePath.join(root, "wiki"), "junction");
      writeAt("tasks/a.md", 1_000_000);
      expect((await readAreas(root)).map((area) => area.id)).toEqual(["tasks"]);
    } finally {
      NodeFS.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("counts units per area and sorts the newest change first", async () => {
    writeAt("tasks/a.md", 1_000_000);
    writeAt("tasks/b.md", 2_000_000);
    writeAt("tasks/tasks-index.md", 9_000_000);
    writeAt("tasks/notes.txt", 9_000_000);
    writeAt("memory/user.md", 3_000_000);
    writeAt("memory/observed/patterns.md", 1_500_000);
    writeAt("projects/alpha/brief.md", 500_000);
    writeAt("projects/beta/brief.md", 600_000);
    writeAt(".agents/skills/plan/SKILL.md", 700_000);
    writeAt("scripts/run.ps1", 9_000_000);
    expect(await readAreas(root)).toEqual([
      { id: "memory", units: 2, changedAt: 3_000_000 },
      { id: "tasks", units: 2, changedAt: 2_000_000 },
      { id: "skills", units: 1, changedAt: 700_000 },
      { id: "projects", units: 2, changedAt: 600_000 },
    ]);
  });

  it("stops counting at the walk cap so a huge area stays cheap", async () => {
    for (let index = 0; index < 5; index++) writeAt(`wiki/page-${index}.md`, 1_000_000);
    expect(await readAreas(root, 3)).toEqual([{ id: "wiki", units: 3, changedAt: 1_000_000 }]);
  });
});
