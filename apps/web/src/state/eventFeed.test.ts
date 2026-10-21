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
