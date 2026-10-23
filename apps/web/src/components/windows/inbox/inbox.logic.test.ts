import { completeFeedEvent, type FeedEventDraft, type FoldedFeedEvent } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  filterInbox,
  groupInbox,
  inboxCounts,
  nextRowIndex,
  rowsOf,
  searchInbox,
  sourceLabel,
  unreadIds,
} from "./inbox.logic";

const NOW = new Date(2026, 9, 21, 15, 0, 0).getTime();
const at = (days: number, hour: number) => new Date(2026, 9, 21 - days, hour, 0, 0).getTime();

const event = (
  title: string,
  when: number,
  extra: Partial<FeedEventDraft> = {},
): FoldedFeedEvent => ({
  ...completeFeedEvent(
    {
      level: "info",
      type: "agent.finished",
      title,
      actor: { kind: "agent", name: "Leonidas" },
      ...extra,
    },
    when,
  ),
  count: 1,
});

const asks = event("Pick a chart", at(0, 9), { level: "needs_you" });
const failed = event("Backup failed", at(0, 3), { level: "failed", type: "script.failed" });
const doneToday = event("Vision map updated", at(0, 12));
const doneOld = event("Weekly report ready", at(2, 16), { body: "Usage went down" });
const answered = event("Old question", at(0, 1), { level: "needs_you" });
const all = [doneOld, answered, doneToday, failed, asks];
const marks = { [answered.id]: { read: true as const } };

describe("groupInbox", () => {
  it("puts unread needs_you and failed events first, newest first", () => {
    const groups = groupInbox(all, marks, NOW);
    expect(groups.map((group) => group.key)).toEqual(["needs-you", "today", "earlier"]);
    expect(groups[0]!.events.map((item) => item.title)).toEqual(["Pick a chart", "Backup failed"]);
  });

  it("splits the rest into today and earlier, newest first, and drops empty groups", () => {
    const groups = groupInbox(all, marks, NOW);
    expect(groups[1]!.events.map((item) => item.title)).toEqual([
      "Vision map updated",
      "Old question",
    ]);
    expect(groups[2]!.events.map((item) => item.title)).toEqual(["Weekly report ready"]);
    expect(groupInbox([doneOld], {}, NOW).map((group) => group.key)).toEqual(["earlier"]);
    expect(groupInbox([], {}, NOW)).toEqual([]);
  });
});

describe("inboxCounts", () => {
  it("counts all, needs you and finished", () => {
    expect(inboxCounts(all, marks)).toEqual({ all: 5, needsYou: 2, finished: 3 });
  });
});

describe("filterInbox", () => {
  const groups = groupInbox(all, marks, NOW);
  it("keeps every group for All", () => {
    expect(rowsOf(filterInbox(groups, "all"))).toHaveLength(5);
  });
  it("keeps only the needs you group, or only the others", () => {
    expect(rowsOf(filterInbox(groups, "needs-you"))).toHaveLength(2);
    expect(rowsOf(filterInbox(groups, "finished")).map((item) => item.title)).toEqual([
      "Vision map updated",
      "Old question",
      "Weekly report ready",
    ]);
  });
});

describe("searchInbox", () => {
  it("matches the title, the body and the source, ignoring case", () => {
    expect(searchInbox(all, "BACKUP").map((item) => item.title)).toEqual(["Backup failed"]);
    expect(searchInbox(all, "usage went").map((item) => item.title)).toEqual([
      "Weekly report ready",
    ]);
    expect(searchInbox(all, "leonidas")).toHaveLength(5);
  });
  it("keeps everything for a blank search", () => {
    expect(searchInbox(all, "   ")).toBe(all);
  });
});

describe("unreadIds", () => {
  it("counts unread the way the rail badge does: not read (dismissed events never reach it)", () => {
    expect(unreadIds(all, marks)).toHaveLength(4);
    expect(unreadIds(all, {})).toHaveLength(5);
  });

  it("lists the ids Mark all as read would mark", () => {
    expect(unreadIds(all, marks).toSorted()).toEqual(
      [asks.id, failed.id, doneToday.id, doneOld.id].toSorted(),
    );
  });
});

describe("nextRowIndex", () => {
  it("moves with the arrow keys and stops at the ends", () => {
    expect(nextRowIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextRowIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextRowIndex("ArrowUp", 0, 3)).toBe(0);
    expect(nextRowIndex("Home", 2, 3)).toBe(0);
    expect(nextRowIndex("End", 0, 3)).toBe(2);
    expect(nextRowIndex("a", 0, 3)).toBeNull();
    expect(nextRowIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("sourceLabel", () => {
  it("names the source in plain words", () => {
    expect(sourceLabel(asks)).toBe("Leonidas");
    expect(
      sourceLabel(event("x", at(0, 1), { actor: { kind: "script", name: "Backup-AIOS.ps1" } })),
    ).toBe("Backup-AIOS.ps1");
  });
});
