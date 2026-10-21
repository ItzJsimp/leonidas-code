import { RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { TimelineEntry, WorkLogEntry } from "../../session-logic";
import { type MessagesTimelineRow, resolveTimelineReveal } from "./MessagesTimeline.logic";

const run = RunId.make("run");
const createdAt = "2026-01-01T00:00:00Z";
const work = (id: string, runId: RunId | null = run): WorkLogEntry =>
  ({ id, createdAt, runId, label: id, tone: "tool" }) as WorkLogEntry;
const entry = (id: string, runId: RunId | null = run): TimelineEntry =>
  ({ id, kind: "work", createdAt, entry: work(id, runId) }) as TimelineEntry;
const entries = ["a", "b", "c", "d"].map((id) => entry(id));
const reveal = (rows: MessagesTimelineRow[], itemId: string, foldRunId: RunId | null = null) =>
  resolveTimelineReveal({ rows, timelineEntries: entries, foldRunId, itemId });

describe("resolveTimelineReveal", () => {
  it("scrolls to the row that shows the item", () => {
    const rows = [
      { kind: "working", id: "w", createdAt },
      {
        kind: "work",
        id: "a",
        createdAt,
        groupedEntries: [work("a"), work("b")],
        isExpandedToolGroup: true,
      },
    ] as MessagesTimelineRow[];
    expect(reveal(rows, "b")).toEqual({ kind: "row", index: 1 });
  });

  it("opens the folded turn first", () => {
    const rows = [
      { kind: "turn-fold", id: "f", createdAt, runId: run, label: "", expanded: false },
    ] as MessagesTimelineRow[];
    expect(reveal(rows, "c", run)).toEqual({ kind: "open-run", runId: run });
  });

  it("opens the live group that holds a running item", () => {
    const rows = [
      {
        kind: "work-live",
        id: "work-live:a",
        createdAt,
        entry: work("c"),
        groupedEntries: [work("a"), work("b"), work("c")],
        groupId: "work-group:a",
        expanded: false,
        active: true,
      },
    ] as MessagesTimelineRow[];
    expect(reveal(rows, "b")).toEqual({ kind: "open-group", groupId: "work-group:a" });
  });

  it("opens the nearest collapsed group before the item, only within one run of tool work", () => {
    const toggle = (first: string) =>
      ({
        kind: "work-toggle",
        id: `work-toggle:${first}`,
        createdAt,
        groupId: `work-group:${first}`,
        hiddenCount: 2,
        expanded: false,
        summary: "",
        summaryKind: "generic",
        hasFailure: false,
      }) as unknown as MessagesTimelineRow;
    expect(reveal([toggle("a"), toggle("c")], "d")).toEqual({
      kind: "open-group",
      groupId: "work-group:c",
    });
    const otherRun = [entry("a"), entry("b", RunId.make("other")), entry("c")];
    expect(
      resolveTimelineReveal({
        rows: [toggle("a")],
        timelineEntries: otherRun,
        foldRunId: null,
        itemId: "c",
      }),
    ).toEqual({ kind: "missing" });
  });

  it("reports an item that is not in the chat", () => {
    expect(reveal([], "zzz")).toEqual({ kind: "missing" });
  });
});
