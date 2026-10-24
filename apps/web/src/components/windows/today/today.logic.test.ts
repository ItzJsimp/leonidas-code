import { describe, expect, it } from "vite-plus/test";

import type { TaskBoardTask } from "@t3tools/contracts";

import { dueRows, priorityKey, priorityViews, prioritySummary, taskCardPath } from "./today.logic";

const item = (title: string, done: boolean) => ({ title, detail: "", done, taskId: null });

describe("prioritySummary", () => {
  it("counts done of total and gives the ring fraction", () => {
    const summary = prioritySummary([item("a", true), item("b", false), item("c", true)]);
    expect(summary.done).toBe(2);
    expect(summary.total).toBe(3);
    expect(summary.label).toBe("2 of 3 done");
    expect(summary.fraction).toBeCloseTo(0.6667, 3);
  });

  it("says no priorities for 0 of 0, never NaN", () => {
    const summary = prioritySummary([]);
    expect(summary.label).toBe("No priorities today");
    expect(summary.fraction).toBe(0);
  });

  it("treats a missing brief like no priorities", () => {
    expect(prioritySummary(null).label).toBe("No priorities today");
  });

  it("says all done when every priority is done", () => {
    const summary = prioritySummary([item("a", true), item("b", true)]);
    expect(summary.label).toBe("All 2 done");
    expect(summary.fraction).toBe(1);
  });
});

const priority = (
  title: string,
  line: string | undefined,
  done: boolean,
  taskId: string | null = null,
) => ({
  title,
  detail: "",
  done,
  taskId,
  ...(line === undefined ? {} : { line }),
});

describe("priorityViews", () => {
  it("shows a local tick over the read value, with the line the server answered", () => {
    const ship = priority("Ship", "- [ ] **Ship:**", false);
    const views = priorityViews(
      [ship],
      new Map([[priorityKey(ship), { done: true, line: "- [x] **Ship:**" }]]),
    );
    expect(views[0]).toMatchObject({ done: true, line: "- [x] **Ship:**", locked: null });
  });

  it("locks a box that is done only because its card is done, or that has no line", () => {
    const [byCard, ticked, old] = priorityViews(
      [
        priority("Card", "- [ ] **Card:**", true, "task-1"),
        priority("Ticked", "- [x] **Ticked:**", true, "task-2"),
        priority("Old", undefined, false),
      ],
      new Map(),
    );
    expect(byCard?.locked).toMatch(/task card is done/);
    expect(ticked?.locked).toBeNull();
    expect(old?.locked).toMatch(/Update Leonidas/);
  });
});

const task = (id: string, extra: Partial<TaskBoardTask>): TaskBoardTask =>
  ({
    id,
    title: `Task ${id}`,
    status: "todo",
    priority: "medium",
    source: "aios_card",
    sourceFile: `${id}.md`,
    ...extra,
  }) as TaskBoardTask;

describe("dueRows", () => {
  it("lists open tasks due today or before, oldest first, then the most urgent", () => {
    const rows = dueRows(
      [
        task("later", { due: "2026-10-25" }),
        task("today-low", { due: "2026-10-24", priority: "low" }),
        task("today-high", { due: "2026-10-24", priority: "high" }),
        task("late", { due: "2026-10-20" }),
        task("done", { due: "2026-10-24", status: "done" }),
        task("none", {}),
      ],
      "2026-10-24",
      "/aios",
    );
    expect(rows.map((row) => row.id)).toEqual(["late", "today-high", "today-low"]);
    expect(rows[0]).toMatchObject({ overdue: true, path: "tasks/late.md" });
    expect(rows[1]?.overdue).toBe(false);
  });

  it("gives no file path for a card outside this AIOS", () => {
    expect(
      taskCardPath({ source: "aios_card", sourceFile: "a.md", sourceRoot: "/x" }, "/aios"),
    ).toBeNull();
    expect(
      taskCardPath(
        { source: "aios_card", sourceFile: "a.md", sourceRoot: "D:\\AIOS\\" },
        "d:/aios",
      ),
    ).toBe("tasks/a.md");
    expect(taskCardPath({ source: "board", sourceFile: null }, "/aios")).toBeNull();
  });
});
