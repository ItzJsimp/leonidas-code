import { describe, expect, it } from "@effect/vitest";
import { ThreadId, type SubagentSpawnApproval } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";

import { makeSpawnApprovals } from "./SpawnApprovals.ts";

const approval = (id: string): SubagentSpawnApproval => ({
  id,
  threadId: ThreadId.make("thread-1"),
  threadTitle: "Build",
  subagent: "frontend-designer",
  model: "claude-opus-5-5",
  account: "Claude",
  reason: "Design the view",
  filesInScope: ["DESIGN.md"],
  toolCount: 6,
  estimatedStartTokens: 12_000,
  tierSource: "app",
  goodFor: "Design",
  requestedAt: "2026-10-16T00:00:00.000Z",
});

const openIds = (broker: Effect.Success<typeof makeSpawnApprovals>) =>
  broker.pending.pipe(
    Stream.take(1),
    Stream.runCollect,
    Effect.map((lists) => lists[0]!.map((a) => a.id)),
  );

describe("SpawnApprovals", () => {
  it.effect("waits for Deny and then drops the card", () =>
    Effect.gen(function* () {
      const broker = yield* makeSpawnApprovals;
      const waiting = yield* Effect.forkChild(broker.request(approval("a")));
      yield* Effect.yieldNow;
      expect(yield* openIds(broker)).toEqual(["a"]);
      yield* broker.respond({ id: "a", decision: { kind: "deny" } });
      expect(yield* Fiber.join(waiting)).toEqual({ kind: "deny" });
      expect(yield* openIds(broker)).toEqual([]);
    }),
  );

  it.effect("remembers Allow for this thread per subagent and model", () =>
    Effect.gen(function* () {
      const broker = yield* makeSpawnApprovals;
      const key = {
        threadId: ThreadId.make("thread-1"),
        subagent: "frontend-designer",
        model: "claude-opus-5-5",
      };
      expect(yield* broker.isAllowedForThread(key)).toBe(false);
      const waiting = yield* Effect.forkChild(broker.request(approval("b")));
      yield* Effect.yieldNow;
      yield* broker.respond({ id: "b", decision: { kind: "allow_thread" } });
      yield* Fiber.join(waiting);
      expect(yield* broker.isAllowedForThread(key)).toBe(true);
      expect(yield* broker.isAllowedForThread({ ...key, model: "claude-fable-5-1" })).toBe(false);
    }),
  );

  it.effect("removes the card when the caller is interrupted", () =>
    Effect.gen(function* () {
      const broker = yield* makeSpawnApprovals;
      const waiting = yield* Effect.forkChild(broker.request(approval("c")));
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(waiting);
      expect(yield* openIds(broker)).toEqual([]);
      const late = yield* broker
        .respond({ id: "c", decision: { kind: "allow_once" } })
        .pipe(Effect.flip);
      expect(late._tag).toBe("SubagentSpawnApprovalError");
    }),
  );
});
