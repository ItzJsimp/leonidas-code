import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { beforeEach, vi } from "vite-plus/test";

const { trays, createFromPathMock, buildFromTemplateMock } = vi.hoisted(() => ({
  trays: [] as Array<{
    destroyed: boolean;
    tooltip: string;
    menu: unknown;
    handlers: Map<string, () => void>;
  }>,
  createFromPathMock: vi.fn((path: string) => ({ path })),
  buildFromTemplateMock: vi.fn((template: unknown) => ({ template })),
}));

vi.mock("electron", () => ({
  nativeImage: { createFromPath: createFromPathMock },
  Menu: { buildFromTemplate: buildFromTemplateMock },
  Tray: class {
    state = {
      destroyed: false,
      tooltip: "",
      menu: undefined as unknown,
      handlers: new Map<string, () => void>(),
    };
    constructor() {
      trays.push(this.state);
    }
    isDestroyed() {
      return this.state.destroyed;
    }
    destroy() {
      this.state.destroyed = true;
    }
    setToolTip(value: string) {
      this.state.tooltip = value;
    }
    setContextMenu(value: unknown) {
      this.state.menu = value;
    }
    on(event: string, handler: () => void) {
      this.state.handlers.set(event, handler);
    }
  },
}));

import * as ElectronTray from "./ElectronTray.ts";

const input = (onActivate: () => void) => ({
  iconPath: "icon.ico",
  tooltip: "Leonidas Code",
  menu: [{ label: "Open" }, { label: "Quit" }],
  onActivate,
});

describe("ElectronTray", () => {
  beforeEach(() => {
    trays.length = 0;
  });

  it.effect("creates one tray, wires the click, and ignores repeat calls", () =>
    Effect.gen(function* () {
      const onActivate = vi.fn();
      const tray = yield* ElectronTray.ElectronTray;
      yield* tray.show(input(onActivate));
      yield* tray.show(input(onActivate));

      assert.equal(trays.length, 1);
      assert.equal(trays[0]?.tooltip, "Leonidas Code");
      trays[0]?.handlers.get("click")?.();
      assert.equal(onActivate.mock.calls.length, 1);
    }).pipe(Effect.provide(ElectronTray.layer)),
  );

  it.effect("hide destroys the tray and show can create a new one", () =>
    Effect.gen(function* () {
      const tray = yield* ElectronTray.ElectronTray;
      yield* tray.show(input(vi.fn()));
      yield* tray.hide;
      yield* tray.show(input(vi.fn()));

      assert.equal(trays.length, 2);
      assert.equal(trays[0]?.destroyed, true);
      assert.equal(trays[1]?.destroyed, false);
    }).pipe(Effect.provide(ElectronTray.layer)),
  );
});
