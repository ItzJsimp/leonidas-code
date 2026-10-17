import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronTray from "../electron/ElectronTray.ts";
import * as DesktopWindow from "../window/DesktopWindow.ts";
import * as DesktopAssets from "./DesktopAssets.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import { makeComponentLogger } from "./DesktopObservability.ts";

const logTrayError = makeComponentLogger("desktop-tray").logError;

/**
 * The tray is the way back to the app while background mode keeps it running
 * with no window: Open shows the window, Quit ends the app and its server.
 */
export class DesktopTray extends Context.Service<
  DesktopTray,
  {
    /** Shows the tray icon once. A missing icon or a tray failure is logged, never thrown. */
    readonly ensure: Effect.Effect<void>;
  }
>()("@t3tools/desktop/app/DesktopTray") {}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const tray = yield* ElectronTray.ElectronTray;
  const assets = yield* DesktopAssets.DesktopAssets;
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const electronApp = yield* ElectronApp.ElectronApp;
  const desktopWindow = yield* DesktopWindow.DesktopWindow;
  const context = yield* Effect.context<never>();
  const run = (effect: Effect.Effect<void>) => void Effect.runPromiseWith(context)(effect);

  const open = desktopWindow.revealOrCreateMain.pipe(
    Effect.catch((cause) => logTrayError("failed to open the window from the tray", { cause })),
    Effect.asVoid,
  );

  return DesktopTray.of({
    ensure: Effect.gen(function* () {
      const icons = yield* assets.iconPaths;
      const iconPath = Option.getOrUndefined(
        environment.platform === "win32" ? icons.ico : icons.png,
      );
      if (iconPath === undefined) {
        return yield* logTrayError("no tray icon found; the tray is not shown", {});
      }
      yield* tray.show({
        iconPath,
        tooltip: "Leonidas Code",
        menu: [
          { label: "Open Leonidas Code", click: () => run(open) },
          { type: "separator" },
          { label: "Quit", click: () => run(electronApp.quit) },
        ],
        onActivate: () => run(open),
      });
    }).pipe(
      Effect.catch((cause) => logTrayError("failed to show the tray", { cause })),
      Effect.asVoid,
    ),
  });
});

export const layer = Layer.effect(DesktopTray, make);
