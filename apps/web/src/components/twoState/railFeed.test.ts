import { completeFeedEvent, type FeedEventDraft, type FoldedFeedEvent } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { actionLabel, splitFeed } from "./railFeed";

const event = (title: string, extra: Partial<FeedEventDraft> = {}): FoldedFeedEvent => ({
  ...completeFeedEvent({
    level: "info",
    type: "agent.finished",
    title,
    actor: { kind: "agent", name: "Leonidas" },
    ...extra,
  }),
  count: 1,
});

describe("splitFeed", () => {
  const waiting = event("Leonidas needs your answer", { level: "needs_you" });
  const failed = event("Backup failed", { level: "failed", type: "script.failed" });
  const done = event("Leonidas finished");
  const answered = event("Old question", { level: "needs_you" });

  it("puts unread needs_you and failed events in Needs you, and the rest in Activity", () => {
    const split = splitFeed([waiting, failed, done, answered], { [answered.id]: { read: true } });
    expect(split.needsYou.map((item) => item.title)).toEqual([
      "Leonidas needs your answer",
      "Backup failed",
    ]);
    expect(split.activity.map((item) => item.title)).toEqual(["Leonidas finished", "Old question"]);
  });

  it("caps Activity so a long feed stays light", () => {
    const many = Array.from({ length: 30 }, (_, index) => event(`Event ${index}`));
    expect(splitFeed(many, {}, 5).activity).toHaveLength(5);
  });
});

describe("actionLabel", () => {
  it("uses the event's own first button", () => {
    const withButton = event("x", {
      actions: [{ label: "Open log", kind: "open_url", ref: "https://example.com" }],
    });
    expect(actionLabel(withButton)).toBe("Open log");
  });

  it("falls back to the target, and gives no button when there is nothing to open", () => {
    expect(actionLabel(event("x", { target: { thread: "thr_1" } }))).toBe("Open chat");
    expect(actionLabel(event("x", { target: { url: "https://example.com" } }))).toBe("Open link");
    expect(actionLabel(event("x"))).toBeNull();
  });
});
