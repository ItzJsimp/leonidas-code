import type { ThreadSweepItem, ThreadSweepResult } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  groupSweepItems,
  idleMinutes,
  initialSelection,
  sweepNotices,
  sweepSummary,
  toggleSelection,
  withoutThreads,
} from "./threadSweep.logic.ts";

const item = (
  threadId: string,
  verdict: ThreadSweepItem["verdict"],
  updatedAt = "2026-10-19T10:00:00.000Z",
): ThreadSweepItem =>
  ({
    threadId,
    projectId: "p",
    title: `Chat ${threadId}`,
    updatedAt,
    verdict,
    source: "rule",
    reason: "x",
  }) as unknown as ThreadSweepItem;

describe("groupSweepItems", () => {
  it("groups by class with the newest first", () => {
    const groups = groupSweepItems([
      item("old", "done", "2026-10-18T10:00:00.000Z"),
      item("new", "done", "2026-10-19T10:00:00.000Z"),
      item("u", "unfinished"),
    ]);
    expect(groups.done.map((i) => i.threadId)).toEqual(["new", "old"]);
    expect(groups.unfinished).toHaveLength(1);
    expect(groups.unsure).toHaveLength(0);
  });
});

describe("selection", () => {
  const items = [item("a", "done"), item("b", "unfinished"), item("c", "done")];

  it("starts with only Done threads checked", () => {
    expect([...initialSelection(items)].sort()).toEqual(["a", "c"]);
  });

  it("toggles one thread without changing the original set", () => {
    const start = initialSelection(items);
    const next = toggleSelection(start, "a");
    expect(next.has("a")).toBe(false);
    expect(start.has("a")).toBe(true);
    expect(toggleSelection(next, "a").has("a")).toBe(true);
  });

  it("removes archived threads from the list", () => {
    expect(withoutThreads(items, new Set(["a"])).map((i) => i.threadId)).toEqual(["b", "c"]);
  });
});

describe("summary, idle and notices", () => {
  it("counts each class in a plain sentence", () => {
    expect(sweepSummary([item("a", "done"), item("b", "unfinished"), item("c", "done")])).toBe(
      "2 done, 1 unfinished, 0 not sure",
    );
    expect(sweepSummary([])).toBe("No chats to review.");
  });

  it("maps idle choices to minutes", () => {
    expect(idleMinutes("1h")).toBe(60);
    expect(idleMinutes("12h")).toBe(720);
    expect(idleMinutes("any")).toBe(0);
  });

  it("explains a missing Laya and a reached model limit, and says nothing otherwise", () => {
    const base = { items: [], layaAvailable: true, modelLimitHit: false } as ThreadSweepResult;
    expect(sweepNotices(base)).toEqual([]);
    expect(sweepNotices({ ...base, layaAvailable: false })[0]).toContain("Laya is not installed");
    expect(sweepNotices({ ...base, modelLimitHit: true })[0]).toContain("first 12");
  });
});
