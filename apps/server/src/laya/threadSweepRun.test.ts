import { it } from "@effect/vitest";
import type { OrchestrationV2ProjectedTurnItem } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { describe, expect } from "vite-plus/test";

import {
  MODEL_LIMIT,
  runThreadSweep,
  tailFromItems,
  type SweepDeps,
  type SweepThread,
} from "./threadSweepRun.ts";

const NOW = Date.parse("2026-10-20T09:00:00Z");
const HOUR = 3_600_000;
const OLD = "2026-10-19T13:00:00.000Z"; // 20 hours before NOW
const RECENT = "2026-10-20T08:00:00.000Z"; // 1 hour before NOW

const thread = (id: string, patch: Partial<SweepThread> = {}): SweepThread => ({
  id,
  projectId: "p1",
  title: `Thread ${id}`,
  updatedAt: OLD,
  archived: false,
  settled: false,
  pinned: false,
  status: "completed",
  hasPendingRequest: false,
  visibleItemCount: 10,
  ...patch,
});

const message = (
  type: "user_message" | "assistant_message",
  text: string,
  streaming = false,
): OrchestrationV2ProjectedTurnItem =>
  ({
    position: 0,
    visibility: "local",
    sourceThreadId: "t",
    sourceItemId: "i",
    item: { type, text, streaming },
  }) as unknown as OrchestrationV2ProjectedTurnItem;

const OPEN_REPLY =
  "I changed three files and the tests pass, and this note is long enough to skip the short rule.";

const makeDeps = (
  threads: ReadonlyArray<SweepThread>,
  replies: Record<string, ReadonlyArray<OrchestrationV2ProjectedTurnItem>>,
  overrides: Partial<SweepDeps> = {},
): SweepDeps & { reads: string[]; assessed: string[] } => {
  const reads: string[] = [];
  const assessed: string[] = [];
  return {
    now: NOW,
    threads: Effect.succeed(threads),
    readItems: (id) => {
      reads.push(id);
      return Effect.succeed(replies[id] ?? []);
    },
    assess: (transcript) => {
      assessed.push(transcript);
      return Effect.succeed({ verdict: "done" as const, reason: "model says finished" });
    },
    score: async (tails) => tails.map(() => [0.5, 0.5] as const),
    ...overrides,
    reads,
    assessed,
  };
};

describe("tailFromItems", () => {
  it("keeps the last user and finished assistant messages and which came last", () => {
    const tail = tailFromItems([
      message("user_message", "first"),
      message("assistant_message", "reply"),
      message("user_message", "second"),
      message("assistant_message", "partial", true),
    ]);
    expect(tail).toEqual({ lastUser: "second", lastAssistant: "reply", endedOn: "user" });
  });
});

describe("runThreadSweep", () => {
  it.effect("skips archived, settled, pinned, active and recent threads", () =>
    Effect.gen(function* () {
      const deps = makeDeps(
        [
          thread("ok"),
          thread("archived", { archived: true }),
          thread("settled", { settled: true }),
          thread("pinned", { pinned: true }),
          thread("running", { status: "running" }),
          thread("recent", { updatedAt: RECENT }),
        ],
        { ok: [message("user_message", "go"), message("assistant_message", "OK")] },
      );
      const result = yield* runThreadSweep(deps, { idleMinutes: 12 * 60 });
      expect(result.items.map((item) => item.threadId)).toEqual(["ok"]);
    }),
  );

  it.effect(
    "sorts by rule without Laya or the model, and reads a pending approval without text",
    () =>
      Effect.gen(function* () {
        let scored = false;
        const deps = makeDeps(
          [
            thread("done"),
            thread("waiting", { hasPendingRequest: true }),
            thread("failed", { status: "failed" }),
          ],
          {
            done: [message("user_message", "go"), message("assistant_message", "OK")],
          },
          {
            score: async () => {
              scored = true;
              return null;
            },
          },
        );
        const result = yield* runThreadSweep(deps, { idleMinutes: 0 });
        const byId = Object.fromEntries(result.items.map((item) => [item.threadId, item]));
        expect(byId.done?.verdict).toBe("done");
        expect(byId.done?.source).toBe("rule");
        expect(byId.waiting?.verdict).toBe("unfinished");
        expect(byId.failed?.verdict).toBe("unfinished");
        expect(deps.reads).toEqual(["done"]);
        expect(scored).toBe(false);
        expect(deps.assessed).toEqual([]);
      }),
  );

  it.effect(
    "sends only Laya abstains to the model, and keeps an empty model answer as unsure",
    () =>
      Effect.gen(function* () {
        const deps = makeDeps(
          [thread("a"), thread("b")],
          {
            a: [message("user_message", "fix it"), message("assistant_message", OPEN_REPLY)],
            b: [message("user_message", "fix it"), message("assistant_message", OPEN_REPLY)],
          },
          {
            assess: (transcript) =>
              Effect.succeed(
                transcript.includes("fix it") ? null : { verdict: "done" as const, reason: "x" },
              ),
          },
        );
        const result = yield* runThreadSweep(deps, { idleMinutes: 0 });
        expect(result.layaAvailable).toBe(true);
        expect(
          result.items.every((item) => item.verdict === "unsure" && item.source === "model"),
        ).toBe(true);
      }),
  );

  it.effect("uses the model when Laya is missing and reports it", () =>
    Effect.gen(function* () {
      const deps = makeDeps(
        [thread("a")],
        { a: [message("user_message", "fix it"), message("assistant_message", OPEN_REPLY)] },
        { score: async () => null },
      );
      const result = yield* runThreadSweep(deps, { idleMinutes: 0 });
      expect(result.layaAvailable).toBe(false);
      expect(result.items[0]).toMatchObject({
        verdict: "done",
        source: "model",
        reason: "model says finished",
      });
    }),
  );

  it.effect("stops at the model limit and leaves the rest unsure", () =>
    Effect.gen(function* () {
      const ids = Array.from({ length: MODEL_LIMIT + 3 }, (_, i) => `t${i}`);
      const deps = makeDeps(
        ids.map((id) => thread(id)),
        Object.fromEntries(
          ids.map((id) => [
            id,
            [message("user_message", "go"), message("assistant_message", OPEN_REPLY)],
          ]),
        ),
      );
      const result = yield* runThreadSweep(deps, { idleMinutes: 0 });
      expect(deps.assessed).toHaveLength(MODEL_LIMIT);
      expect(result.modelLimitHit).toBe(true);
      expect(result.items.filter((item) => item.verdict === "unsure")).toHaveLength(3);
    }),
  );
});
