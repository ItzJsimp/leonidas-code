import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import { getBackgroundMode, setBackgroundMode } from "./backgroundMode.ts";

describe("background mode IPC", () => {
  it.effect("reads the default, saves a change, and keeps other settings", () =>
    Effect.gen(function* () {
      assert.isFalse(yield* getBackgroundMode.handler(undefined));
      assert.isTrue(yield* setBackgroundMode.handler(true));
      assert.isTrue(yield* getBackgroundMode.handler(undefined));
      const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
      assert.isTrue((yield* appSettings.get).localEnvironmentEnabled);
      assert.isFalse(yield* setBackgroundMode.handler(false));
    }).pipe(Effect.provide(DesktopAppSettings.layerTest())),
  );
});
