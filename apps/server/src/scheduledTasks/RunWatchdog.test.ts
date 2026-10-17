import { assert, describe, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";

import { type RunActivity, watchRunForIdle } from "./RunWatchdog.ts";

const LIMIT_MS = 60_000;

const setup = (initial: Option.Option<RunActivity>) =>
  Effect.gen(function* () {
    const run = yield* Ref.make(initial);
    const interrupts = yield* Ref.make(0);
    const watch = (idleLimitMs = LIMIT_MS) =>
      watchRunForIdle({
        idleLimitMs,
        readRun: Ref.get(run),
        interrupt: Ref.update(interrupts, (count) => count + 1),
        nowMs: Clock.currentTimeMillis,
      });
    return { run, interrupts, watch };
  });

describe("watchRunForIdle", () => {
  it.effect("interrupts a run that stops producing activity", () =>
    Effect.gen(function* () {
      const { interrupts, watch } = yield* setup(
        Option.some({ status: "running", lastActivityMs: 0 }),
      );
      const fiber = yield* Effect.forkChild(watch());
      yield* TestClock.adjust(LIMIT_MS + 10_000);
      assert.equal(yield* Fiber.join(fiber), "interrupted");
      assert.equal(yield* Ref.get(interrupts), 1);
    }),
  );

  it.effect("does not cut a long run that keeps producing activity", () =>
    Effect.gen(function* () {
      const { run, interrupts, watch } = yield* setup(
        Option.some({ status: "running", lastActivityMs: 0 }),
      );
      const fiber = yield* Effect.forkChild(watch());
      // Ten limits pass, but progress lands every 30 s.
      for (let step = 1; step <= 20; step += 1) {
        yield* TestClock.adjust(30_000);
        yield* Ref.set(run, Option.some({ status: "running", lastActivityMs: step * 30_000 }));
      }
      assert.equal(yield* Ref.get(interrupts), 0);
      yield* Ref.set(run, Option.some({ status: "completed", lastActivityMs: 600_000 }));
      yield* TestClock.adjust(30_000);
      assert.equal(yield* Fiber.join(fiber), "ended");
      assert.equal(yield* Ref.get(interrupts), 0);
    }),
  );

  it.effect("does not count a queued run as idle", () =>
    Effect.gen(function* () {
      const { run, interrupts, watch } = yield* setup(
        Option.some({ status: "queued", lastActivityMs: 0 }),
      );
      const fiber = yield* Effect.forkChild(watch());
      yield* TestClock.adjust(LIMIT_MS * 5);
      assert.equal(yield* Ref.get(interrupts), 0);
      yield* Ref.set(run, Option.none());
      yield* TestClock.adjust(20_000);
      assert.equal(yield* Fiber.join(fiber), "ended");
    }),
  );

  it.effect("is off when the limit is 0", () =>
    Effect.gen(function* () {
      const { interrupts, watch } = yield* setup(
        Option.some({ status: "running", lastActivityMs: 0 }),
      );
      assert.equal(yield* watch(0), "ended");
      assert.equal(yield* Ref.get(interrupts), 0);
    }),
  );
});
