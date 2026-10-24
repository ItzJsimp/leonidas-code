import { completeFeedEvent, type FoldedFeedEvent } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { applyFeedUpdate, EMPTY_FEED_VIEW } from "./eventFeed";

const event = (title: string, count = 1): FoldedFeedEvent => ({
  ...completeFeedEvent({
    level: "failed",
    type: "script.failed",
    title,
    actor: { kind: "script", name: "t.ps1" },
  }),
  count,
});

describe("applyFeedUpdate", () => {
  it("never marks snapshot events as fresh, so old events do not pop", () => {
    const view = applyFeedUpdate(EMPTY_FEED_VIEW, {
      kind: "snapshot",
      events: [event("a"), event("b")],
      bad: [],
    });
    expect(view.events.map((e) => e.title)).toEqual(["b", "a"]);
    expect(view.fresh).toEqual([]);
  });

  it("marks only new ids as fresh; a raised fold count updates in place", () => {
    const first = event("backup failed");
    const start = applyFeedUpdate(EMPTY_FEED_VIEW, { kind: "snapshot", events: [first], bad: [] });
    const added = event("new");
    const view = applyFeedUpdate(start, {
      kind: "upsert",
      events: [{ ...first, count: 2 }, added],
      bad: [],
    });
    expect(view.fresh.map((e) => e.id)).toEqual([added.id]);
    expect(view.events.map((e) => [e.title, e.count])).toEqual([
      ["new", 1],
      ["backup failed", 2],
    ]);
  });
});

describe("feed trim", () => {
  it("keeps only the newest 1000 waiters through snapshots and upserts", () => {
    const waiting = Array.from({ length: 1001 }, (_, i) => event(`wait ${i}`));
    const view = applyFeedUpdate(EMPTY_FEED_VIEW, { kind: "snapshot", events: waiting, bad: [] });
    expect(view.events).toHaveLength(1000);
    expect(view.events.at(-1)?.title).toBe("wait 1");
    const next = applyFeedUpdate(view, { kind: "upsert", events: [event("new wait")], bad: [] });
    expect(next.events).toHaveLength(1000);
    expect(next.events.at(-1)?.title).toBe("wait 2");
  });
  const note = (index: number): FoldedFeedEvent => ({
    ...completeFeedEvent({
      level: "info",
      type: "fixture.note",
      title: `note ${index}`,
      actor: { kind: "script", name: "t.ps1" },
    }),
    count: 1,
  });

  it("keeps an older event that needs the user past the 500 cap, on a snapshot and on an upsert", () => {
    const waiting = event("backup failed, waits for you");
    const notes = Array.from({ length: 500 }, (_, index) => note(index));
    // Snapshots arrive oldest first.
    const view = applyFeedUpdate(EMPTY_FEED_VIEW, {
      kind: "snapshot",
      events: [waiting, ...notes],
      bad: [],
    });
    expect(view.events.map((e) => e.title)).toContain(waiting.title);
    const next = applyFeedUpdate(view, { kind: "upsert", events: [note(500)], bad: [] });
    expect(next.events.map((e) => e.title)).toContain(waiting.title);
    expect(next.events).toHaveLength(501);
  });
});
