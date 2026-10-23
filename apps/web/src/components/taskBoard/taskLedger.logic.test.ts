import type { FeedEvent } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { ledgerFor, presenceKey } from "./taskLedger.logic";

const event = (id: string, ts: string, type: string, task: string) =>
  ({ id, ts, type, target: { task } }) as unknown as FeedEvent;

describe("ledgerFor", () => {
  it("keeps only this card's task.worked entries, newest first", () => {
    const events = [
      event("a", "2026-10-21T10:00:00Z", "task.worked", "t1"),
      event("b", "2026-10-22T10:00:00Z", "task.worked", "t1"),
      event("c", "2026-10-22T11:00:00Z", "task.worked", "t2"),
      event("d", "2026-10-22T12:00:00Z", "agent.finished", "t1"),
    ];
    expect(ledgerFor(events, "t1").map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("presenceKey", () => {
  const chat = (threadId: string, status: "running" | "waiting") => ({
    threadId,
    title: threadId,
    agent: "x",
    model: "y",
    status,
  });

  it("changes when a chat starts, stops or waits, and not otherwise", () => {
    const base = new Map([["t1", [chat("a", "running")]]]);
    expect(presenceKey(base)).toBe(presenceKey(new Map([["t1", [chat("a", "running")]]])));
    expect(presenceKey(base)).not.toBe(presenceKey(new Map([["t1", [chat("a", "waiting")]]])));
    expect(presenceKey(base)).not.toBe(presenceKey(new Map()));
  });
});
