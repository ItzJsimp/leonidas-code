import type { TaskBoardTask } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildBatchPrompt,
  pickQuickBatches,
  suggestTriage,
  taskSize,
  type TaskView,
} from "./taskBoard.logic";

function view(id: string, overrides: Partial<TaskView> = {}): TaskView {
  return {
    id,
    project: "App",
    title: `Task ${id}`,
    description: "",
    status: "todo",
    priority: "medium",
    claimedBy: null,
    claimedAgent: null,
    completedBy: null,
    completedAt: null,
    completionSummary: null,
    createdAt: 0,
    updatedAt: 0,
    labels: [],
    source: "aios_card",
    effort: "Low",
    origin: "local",
    section: "app",
    ...overrides,
  } as TaskView;
}

describe("pickQuickBatches", () => {
  it("groups small unclaimed tasks by project and skips lone leftovers", () => {
    const batches = pickQuickBatches([
      view("a"),
      view("b", { priority: "high" }),
      view("c", { section: "other" }),
      view("d", { effort: "High" }),
      view("e", { claimedBy: "Jake" }),
      view("f", { blockedBy: ["x"] }),
      view("g", { section: "general" }),
    ]);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("caps a batch at five tasks", () => {
    const many = Array.from({ length: 11 }, (_, i) => view(`t${i}`));
    expect(pickQuickBatches(many).map((b) => b.tasks.length)).toEqual([5, 5]);
  });
});

describe("buildBatchPrompt", () => {
  it("numbers every task", () => {
    const text = buildBatchPrompt([view("a"), view("b")] as TaskBoardTask[], {
      aiosRoot: null,
      member: "Mob",
    });
    expect(text).toContain("Task 1 of 2");
    expect(text).toContain("Task 2 of 2");
  });
});

describe("taskSize", () => {
  it("trusts a card's own effort", () => {
    expect(taskSize(view("a", { effort: "High", description: "x" }))).toBe("large");
    expect(taskSize(view("b", { effort: "Medium" }))).toBe("medium");
  });

  it("sizes cards without effort from description, checklist and title", () => {
    const none = { effort: null } as const;
    expect(taskSize(view("a", { ...none, description: "Fix typo" }))).toBe("small");
    expect(taskSize(view("b", { ...none, description: "x".repeat(600) }))).toBe("medium");
    expect(taskSize(view("c", { ...none, description: "x".repeat(1500) }))).toBe("large");
    expect(taskSize(view("d", { ...none, checklist: { done: 0, total: 10 } }))).toBe("large");
    expect(taskSize(view("e", { ...none, title: "Refactor the router" }))).toBe("large");
  });
});

describe("suggestTriage", () => {
  it("adds missing effort and topic labels without touching existing ones", () => {
    const result = suggestTriage(
      view("a", {
        effort: null,
        title: "Fix login crash",
        labels: ["mobile"],
        description: "short",
      }),
    );
    expect(result).toEqual({ effort: "Low", labels: ["mobile", "bug"] });
  });

  it("returns null when nothing is missing", () => {
    expect(suggestTriage(view("a", { title: "Plain note", labels: [] }))).toBeNull();
  });
});
