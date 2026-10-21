// @effect-diagnostics nodeBuiltinImport:off - the test writes a real feed file in a temp folder.
import { completeFeedEvent } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { feedStream } from "./eventsRpc.ts";
import { appendFeedEvent } from "./feedFile.ts";

describe("feedStream", () => {
  it.effect("starts the feed when an AIOS is connected after the client subscribed", () =>
    Effect.gen(function* () {
      const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "feed-rpc-"));
      appendFeedEvent(
        root,
        completeFeedEvent({
          level: "info",
          type: "script.info",
          title: "already there",
          actor: { kind: "script", name: "t.ps1" },
        }),
      );
      let connected: string | null = null;
      const fiber = yield* feedStream(Effect.sync(() => connected)).pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.forkChild,
      );
      yield* TestClock.adjust("1 second");
      connected = root;
      yield* TestClock.adjust("30 seconds");
      const updates = yield* Fiber.join(fiber);
      NodeFS.rmSync(root, { recursive: true, force: true });
      expect(updates.map((update) => update.events.length)).toEqual([0, 1]);
    }),
  );
});
