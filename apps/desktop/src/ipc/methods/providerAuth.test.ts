import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type * as Electron from "electron";

import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import { revealMainWindow } from "./providerAuth.ts";

describe("revealMainWindow", () => {
  it.effect("prepares the foreground switch, then shows the main window", () => {
    const window = { id: 7 } as Electron.BrowserWindow;
    const calls: string[] = [];

    return Effect.gen(function* () {
      yield* revealMainWindow.handler(undefined);
      assert.deepStrictEqual(calls, ["prepare:7", "reveal:7"]);
    }).pipe(
      Effect.provide(
        Layer.mock(ElectronWindow.ElectronWindow)({
          currentMainOrFirst: Effect.succeedSome(window),
          prepareReveal: (target) => Effect.sync(() => (calls.push(`prepare:${target.id}`), true)),
          reveal: (target) => Effect.sync(() => void calls.push(`reveal:${target.id}`)),
        }),
      ),
    );
  });

  it.effect("does nothing when no window is open", () =>
    revealMainWindow.handler(undefined).pipe(
      Effect.provide(
        Layer.mock(ElectronWindow.ElectronWindow)({
          currentMainOrFirst: Effect.succeedNone,
        }),
      ),
    ),
  );
});
