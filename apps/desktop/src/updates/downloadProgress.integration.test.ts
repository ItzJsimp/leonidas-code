import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import * as DesktopUpdates from "./DesktopUpdates.ts";
import { flushCallbacks, makeHarness } from "./updatesTestHarness.ts";
describe("desktop download telemetry", () => {
  it.effect("hands every install to a visible installer", () => {
    const harness = makeHarness();
    return Effect.scoped(
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates.DesktopUpdates;
        yield* updates.configure;
        harness.emit("update-downloaded", { version: "0.2.2" });
        yield* flushCallbacks;
        yield* updates.install;
        assert.deepEqual(harness.installOptions(), { isSilent: false, isForceRunAfter: true });
      }),
    ).pipe(Effect.provide(harness.layer));
  });
  it.effect("publishes actual transfer telemetry even within the same percentage milestone", () => {
    const harness = makeHarness();
    return Effect.scoped(
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates.DesktopUpdates;
        yield* updates.configure;
        harness.emit("update-available", { version: "0.2.2" });
        yield* flushCallbacks;
        harness.emit("download-progress", {
          percent: 20,
          transferred: 200,
          total: 1000,
          bytesPerSecond: 100,
        });
        yield* flushCallbacks;
        assert.equal((yield* updates.getState).downloadProgress?.remainingSeconds, 8);
        yield* TestClock.adjust("2 seconds");
        harness.emit("download-progress", {
          percent: 20,
          transferred: 200,
          total: 1000,
          bytesPerSecond: 0,
        });
        yield* flushCallbacks;
        const state = yield* updates.getState;
        assert.equal(state.downloadProgress?.elapsedSeconds, 2);
        assert.isNull(state.downloadProgress?.remainingSeconds);
        harness.emit("error", new Error("connection lost"));
        yield* flushCallbacks;
        assert.equal((yield* updates.getState).errorContext, "download");
        assert.equal((yield* updates.getState).status, "available");
        assert.isTrue((yield* updates.download).accepted);
      }),
    ).pipe(Effect.provide(Layer.merge(TestClock.layer(), harness.layer)));
  });
});
