// @effect-diagnostics globalTimers:off -- The overlay safety timeout runs at an Electron callback boundary outside Effect fibers.
// @effect-diagnostics nodeBuiltinImport:off -- This desktop-only module writes its own temporary overlay files.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as Electron from "electron";

import { SNIP_OVERLAY_EVENT_CHANNEL, SNIP_OVERLAY_VIEW_CHANNEL } from "../ipc/channels.ts";
import type { SnipFrame } from "./SnipCompose.ts";
import type { SnipDisplay } from "./SnipGeometry.ts";
import { renderSnipOverlayPage } from "./SnipOverlayPage.ts";
import type { SnipOutcome, SnipSession } from "./SnipSession.ts";

/** A stuck full-screen overlay is worse than a lost snip, so it closes itself. */
const SNIP_OVERLAY_TIMEOUT_MS = 5 * 60_000;
const FRAME_JPEG_QUALITY = 88;

type OverlayEvent = {
  readonly type: "move" | "down" | "up" | "cancel";
  readonly displayId: number;
  readonly x: number;
  readonly y: number;
};

function isOverlayEvent(value: unknown): value is OverlayEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    (event.type === "move" ||
      event.type === "down" ||
      event.type === "up" ||
      event.type === "cancel") &&
    typeof event.displayId === "number" &&
    typeof event.x === "number" &&
    typeof event.y === "number" &&
    Number.isFinite(event.x) &&
    Number.isFinite(event.y)
  );
}

export type SnipOverlay = {
  readonly pick: (input: {
    readonly session: SnipSession;
    readonly displays: ReadonlyArray<SnipDisplay>;
    readonly frames: ReadonlyMap<number, SnipFrame>;
  }) => Promise<SnipOutcome>;
  /** Closes windows and deletes temporary files. Safe to call more than once. */
  readonly release: () => void;
};

export function makeSnipOverlay(input: { readonly preloadPath: string }): SnipOverlay {
  let tempDir: string | undefined;
  let windows: Electron.BrowserWindow[] = [];
  let cleanup: (() => void) | undefined;

  const release = () => {
    cleanup?.();
    cleanup = undefined;
    for (const window of windows) if (!window.isDestroyed()) window.destroy();
    windows = [];
    const dir = tempDir;
    tempDir = undefined;
    if (dir) void NodeFSP.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  };

  const pick: SnipOverlay["pick"] = async ({ session, displays, frames }) => {
    const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "leonidas-snip-"));
    tempDir = dir;

    const created: Array<{ display: SnipDisplay; window: Electron.BrowserWindow }> = [];
    for (const display of displays) {
      const frame = frames.get(display.id);
      if (!frame) continue;
      const frameFile = `frame-${String(display.id)}.jpg`;
      const jpeg = Electron.nativeImage
        .createFromBitmap(frame.bgra, { width: frame.width, height: frame.height })
        .toJPEG(FRAME_JPEG_QUALITY);
      await NodeFSP.writeFile(NodePath.join(dir, frameFile), jpeg);
      await NodeFSP.writeFile(
        NodePath.join(dir, `overlay-${String(display.id)}.html`),
        renderSnipOverlayPage({
          displayId: display.id,
          frameFile,
          originX: display.physicalBounds.x,
          originY: display.physicalBounds.y,
          scaleFactor: display.scaleFactor,
        }),
      );
      const window = new Electron.BrowserWindow({
        ...display.dipBounds,
        show: false,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        hasShadow: false,
        backgroundColor: "#000000",
        webPreferences: {
          preload: input.preloadPath,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      window.setAlwaysOnTop(true, "screen-saver");
      created.push({ display, window });
    }
    windows = created.map((entry) => entry.window);
    if (created.length === 0) return { kind: "cancelled" };

    return await new Promise<SnipOutcome>((resolve) => {
      let settled = false;
      const finish = (outcome: SnipOutcome) => {
        if (settled) return;
        settled = true;
        resolve(outcome);
      };

      const byWebContents = new Map(
        created.map((entry) => [entry.window.webContents.id, entry.display]),
      );
      const toPhysical = (display: SnipDisplay, event: OverlayEvent) => ({
        x: Math.round(display.physicalBounds.x + event.x * display.scaleFactor),
        y: Math.round(display.physicalBounds.y + event.y * display.scaleFactor),
      });
      const broadcast = (view: unknown) => {
        for (const { window } of created) {
          if (!window.isDestroyed()) window.webContents.send(SNIP_OVERLAY_VIEW_CHANNEL, view);
        }
      };

      const onEvent = (ipcEvent: Electron.IpcMainEvent, payload: unknown) => {
        const display = byWebContents.get(ipcEvent.sender.id);
        if (!display || !isOverlayEvent(payload)) return;
        if (payload.type === "cancel") return finish(session.cancel());
        const point = toPhysical(display, payload);
        if (payload.type === "move") return broadcast(session.move(point));
        if (payload.type === "down") return session.down(point);
        const outcome = session.up(point);
        if (outcome) finish(outcome);
      };
      Electron.ipcMain.on(SNIP_OVERLAY_EVENT_CHANNEL, onEvent);

      const timeout = setTimeout(() => finish(session.cancel()), SNIP_OVERLAY_TIMEOUT_MS);
      cleanup = () => {
        clearTimeout(timeout);
        Electron.ipcMain.removeListener(SNIP_OVERLAY_EVENT_CHANNEL, onEvent);
      };

      const cursorDisplayId = Electron.screen.getDisplayNearestPoint(
        Electron.screen.getCursorScreenPoint(),
      ).id;
      for (const { display, window } of created) {
        window.on("closed", () => finish({ kind: "cancelled" }));
        window.webContents.on("before-input-event", (event, keyboard) => {
          if (keyboard.type === "keyDown" && keyboard.key === "Escape") {
            event.preventDefault();
            finish(session.cancel());
          }
        });
        window.once("ready-to-show", () => {
          window.setBounds(display.dipBounds);
          window.show();
          if (display.id === cursorDisplayId) window.focus();
        });
        void window
          .loadFile(NodePath.join(dir, `overlay-${String(display.id)}.html`))
          .catch(() => finish({ kind: "cancelled" }));
      }
    });
  };

  return { pick, release };
}
