import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronTray from "../electron/ElectronTray.ts";
import * as DesktopWindow from "../window/DesktopWindow.ts";
import * as DesktopAssets from "./DesktopAssets.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import * as DesktopTray from "./DesktopTray.ts";

function makeLayer(input: {
  readonly ico: Option.Option<string>;
  readonly shown: ElectronTray.ElectronTrayInput[];
  readonly counts: { open: number; quit: number };
}) {
  return DesktopTray.layer.pipe(
    Layer.provideMerge(
      Layer.succeed(ElectronTray.ElectronTray, {
        show: (trayInput) =>
          Effect.sync(() => {
            input.shown.push(trayInput);
          }),
        hide: Effect.void,
      }),
    ),
    Layer.provideMerge(
      Layer.succeed(DesktopAssets.DesktopAssets, {
        iconPaths: Effect.succeed({
          ico: input.ico,
          icns: Option.none(),
          png: Option.none(),
        }),
        resolveResourcePath: () => Effect.succeed(Option.none()),
      }),
    ),
    Layer.provideMerge(
      Layer.succeed(DesktopEnvironment.DesktopEnvironment, {
        platform: "win32",
      } as DesktopEnvironment.DesktopEnvironment["Service"]),
    ),
    Layer.provideMerge(
      Layer.succeed(ElectronApp.ElectronApp, {
        quit: Effect.sync(() => {
          input.counts.quit += 1;
        }),
      } as unknown as ElectronApp.ElectronApp["Service"]),
    ),
    Layer.provideMerge(
      Layer.succeed(DesktopWindow.DesktopWindow, {
        revealOrCreateMain: Effect.sync(() => {
          input.counts.open += 1;
          return {} as never;
        }),
      } as unknown as DesktopWindow.DesktopWindow["Service"]),
    ),
  );
}

const settle = () =>
  // The menu handlers run their effect on a promise; give it real time to finish.
  // @effect-diagnostics-next-line globalTimers:off
  Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));

describe("DesktopTray", () => {
  it.effect("shows a tray with Open and Quit that act on the window and the app", () =>
    Effect.gen(function* () {
      const shown: ElectronTray.ElectronTrayInput[] = [];
      const counts = { open: 0, quit: 0 };
      yield* Effect.gen(function* () {
        const tray = yield* DesktopTray.DesktopTray;
        yield* tray.ensure;
      }).pipe(Effect.provide(makeLayer({ ico: Option.some("icon.ico"), shown, counts })));

      assert.equal(shown.length, 1);
      assert.equal(shown[0]?.iconPath, "icon.ico");
      const menu = shown[0]?.menu ?? [];
      const open = menu[0];
      const quit = menu[2];
      assert.equal(open?.label, "Open Leonidas Code");
      assert.equal(quit?.label, "Quit");

      (open!.click as () => void)();
      shown[0]?.onActivate();
      (quit!.click as () => void)();
      yield* settle();
      assert.deepEqual(counts, { open: 2, quit: 1 });
    }),
  );

  it.effect("shows no tray when there is no icon", () =>
    Effect.gen(function* () {
      const shown: ElectronTray.ElectronTrayInput[] = [];
      yield* Effect.gen(function* () {
        const tray = yield* DesktopTray.DesktopTray;
        yield* tray.ensure;
      }).pipe(
        Effect.provide(makeLayer({ ico: Option.none(), shown, counts: { open: 0, quit: 0 } })),
      );
      assert.equal(shown.length, 0);
    }),
  );
});
