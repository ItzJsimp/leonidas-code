import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

export interface ElectronTrayInput {
  readonly iconPath: string;
  readonly tooltip: string;
  readonly menu: readonly Electron.MenuItemConstructorOptions[];
  readonly onActivate: () => void;
}

export class ElectronTrayCreateError extends Schema.TaggedError<ElectronTrayCreateError>()(
  "ElectronTrayCreateError",
  {
    iconPath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to create the tray icon from ${this.iconPath}.`;
  }
}

export class ElectronTray extends Context.Service<
  ElectronTray,
  {
    /** Creates the tray icon once; later calls do nothing while it exists. */
    readonly show: (input: ElectronTrayInput) => Effect.Effect<void, ElectronTrayCreateError>;
    readonly hide: Effect.Effect<void>;
  }
>()("@t3tools/desktop/electron/ElectronTray") {}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.sync(() => {
  let tray: Electron.Tray | undefined;
  return ElectronTray.of({
    show: (input) =>
      Effect.try({
        try: () => {
          if (tray !== undefined && !tray.isDestroyed()) return;
          const created = new Electron.Tray(Electron.nativeImage.createFromPath(input.iconPath));
          created.setToolTip(input.tooltip);
          created.setContextMenu(Electron.Menu.buildFromTemplate([...input.menu]));
          created.on("click", input.onActivate);
          tray = created;
        },
        catch: (cause) => new ElectronTrayCreateError({ iconPath: input.iconPath, cause }),
      }),
    hide: Effect.sync(() => {
      if (tray !== undefined && !tray.isDestroyed()) tray.destroy();
      tray = undefined;
    }),
  });
});

export const layer = Layer.effect(ElectronTray, make);
