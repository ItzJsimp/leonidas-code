// Runs one snip from frozen frames to a saved PNG. Electron, the overlay and the disk are injected.
import type { DesktopSnipResult } from "@t3tools/contracts";

import { composeBitmap, type SnipFrame } from "./SnipCompose.ts";
import { cropPiecesForRect, type SnipDisplay, type SnipWindow } from "./SnipGeometry.ts";
import { createSnipSession, type SnipOutcome, type SnipSession } from "./SnipSession.ts";

export interface SnipRunnerDeps {
  readonly displays: ReadonlyArray<SnipDisplay>;
  /** One frozen frame per display, at physical size. */
  readonly captureFrames: (
    displays: ReadonlyArray<SnipDisplay>,
  ) => Promise<ReadonlyMap<number, SnipFrame>>;
  readonly listWindows: () => ReadonlyArray<SnipWindow>;
  /** Shows the overlay and resolves when the user picks or cancels. */
  readonly pick: (input: {
    readonly session: SnipSession;
    readonly displays: ReadonlyArray<SnipDisplay>;
    readonly frames: ReadonlyMap<number, SnipFrame>;
  }) => Promise<SnipOutcome>;
  readonly encodePng: (frame: SnipFrame) => Buffer;
  readonly save: (png: Buffer) => Promise<{ readonly path: string; readonly name: string }>;
  /** Called once on every exit so the frozen frames and overlay files go away. */
  readonly release?: () => void;
}

const UNSAVED_NAME = "snip.png";

export async function runSnip(deps: SnipRunnerDeps): Promise<DesktopSnipResult> {
  try {
    const frames = await deps.captureFrames(deps.displays);
    if (frames.size === 0) return { status: "cancelled" };
    const session = createSnipSession({ displays: deps.displays, windows: deps.listWindows() });
    const outcome = await deps.pick({ session, displays: deps.displays, frames });
    if (outcome.kind === "cancelled") return { status: "cancelled" };

    const { rect } = outcome;
    const pieces = cropPiecesForRect(deps.displays, rect);
    if (pieces.length === 0) return { status: "cancelled" };
    const image: SnipFrame = {
      width: rect.width,
      height: rect.height,
      bgra: composeBitmap(pieces, frames, rect),
    };
    const png = deps.encodePng(image);
    const saved = await deps.save(png).catch(() => ({ path: "", name: UNSAVED_NAME }));
    return {
      status: "saved",
      path: saved.path,
      name: saved.name,
      width: image.width,
      height: image.height,
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    };
  } finally {
    deps.release?.();
  }
}
