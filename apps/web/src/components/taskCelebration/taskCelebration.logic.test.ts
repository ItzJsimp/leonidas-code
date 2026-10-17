import type { TaskBoardCompletion } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { celebrationMessage, takeFreshCompletions } from "./taskCelebration.logic";

const NOW = Date.parse("2026-10-15T12:00:00Z");

const completion = (id: string, overrides: Partial<TaskBoardCompletion> = {}) =>
  ({
    id,
    taskId: `task-${id}`,
    title: `Task ${id}`,
    projectSlug: null,
    actor: "Jake",
    byAgent: false,
    completedAt: NOW - 1_000,
    ...overrides,
  }) satisfies TaskBoardCompletion;

describe("takeFreshCompletions", () => {
  it("treats the first list as already seen, so opening the app never celebrates", () => {
    const first = takeFreshCompletions(null, [completion("a")], NOW);
    expect(first.fresh).toEqual([]);
    expect(first.seen.has("a")).toBe(true);
  });

  it("returns only completions it has not seen before", () => {
    const first = takeFreshCompletions(null, [completion("a")], NOW);
    const next = takeFreshCompletions(first.seen, [completion("a"), completion("b")], NOW);
    expect(next.fresh.map((item) => item.id)).toEqual(["b"]);
    const again = takeFreshCompletions(next.seen, [completion("a"), completion("b")], NOW);
    expect(again.fresh).toEqual([]);
  });

  it("skips a completion older than ten minutes, such as one replayed after a long disconnect", () => {
    const first = takeFreshCompletions(null, [], NOW);
    const next = takeFreshCompletions(
      first.seen,
      [completion("old", { completedAt: NOW - 11 * 60_000 }), completion("new")],
      NOW,
    );
    expect(next.fresh.map((item) => item.id)).toEqual(["new"]);
    expect(next.seen.has("old")).toBe(true);
  });
  it("forgets ids the server list no longer holds, so memory stays bounded", () => {
    const first = takeFreshCompletions(null, [completion("a"), completion("b")], NOW);
    const next = takeFreshCompletions(first.seen, [completion("b"), completion("c")], NOW);
    expect([...next.seen].sort()).toEqual(["b", "c"]);
    expect(next.fresh.map((item) => item.id)).toEqual(["c"]);
  });
});

describe("celebrationMessage", () => {
  it("names the task and credits the agent when an agent completed it", () => {
    expect(celebrationMessage(completion("a"), 0)).toContain("Task a");
    expect(celebrationMessage(completion("a", { byAgent: true }), 0)).toBe(
      "Your agent completed Task a.",
    );
  });

  it("rotates between lines and stays in range for any pick", () => {
    const lines = new Set(
      [0, 1, 2, 3, 99].map((pick) => celebrationMessage(completion("a"), pick)),
    );
    expect(lines.size).toBeGreaterThan(1);
    for (const line of lines) expect(line).toContain("Task a");
  });
});
