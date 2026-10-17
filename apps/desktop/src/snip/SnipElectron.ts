// @effect-diagnostics globalDate:off -- The file name needs local calendar fields, read once at the Electron boundary.
// @effect-diagnostics nodeBuiltinImport:off -- This desktop-only module writes snips to disk.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import * as Electron from "electron";

import type { SnipFrame } from "./SnipCompose.ts";
import type { SnipDisplay } from "./SnipGeometry.ts";

export function readSnipDisplays(): ReadonlyArray<SnipDisplay> {
  return Electron.screen.getAllDisplays().map((display) => ({
    id: display.id,
    dipBounds: display.bounds,
    physicalBounds: Electron.screen.dipToScreenRect(null, display.bounds),
    scaleFactor: display.scaleFactor,
  }));
}

/** Captures each display at its true physical size, one call per distinct size. */
export async function captureSnipFrames(
  displays: ReadonlyArray<SnipDisplay>,
): Promise<ReadonlyMap<number, SnipFrame>> {
  const frames = new Map<number, SnipFrame>();
  const bySize = new Map<string, SnipDisplay[]>();
  for (const display of displays) {
    const key = `${String(display.physicalBounds.width)}x${String(display.physicalBounds.height)}`;
    bySize.set(key, [...(bySize.get(key) ?? []), display]);
  }
  for (const group of bySize.values()) {
    const first = group[0];
    if (!first) continue;
    const sources = await Electron.desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: first.physicalBounds.width, height: first.physicalBounds.height },
    });
    for (const display of group) {
      const source = sources.find((candidate) => candidate.display_id === String(display.id));
      if (!source || source.thumbnail.isEmpty()) continue;
      const size = source.thumbnail.getSize();
      frames.set(display.id, {
        width: size.width,
        height: size.height,
        bgra: source.thumbnail.toBitmap(),
      });
    }
  }
  return frames;
}

export function encodeSnipPng(frame: SnipFrame): Buffer {
  return Electron.nativeImage
    .createFromBitmap(frame.bgra, { width: frame.width, height: frame.height })
    .toPNG();
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/** `snip-20261016-173045-123.png`, in local time so the name matches the user's clock. */
export function snipFileName(date: Date): string {
  const day = `${String(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `snip-${day}-${time}-${pad(date.getMilliseconds(), 3)}.png`;
}

export async function saveSnipPng(
  directory: string,
  png: Buffer,
  nowMs: number,
): Promise<{ readonly path: string; readonly name: string }> {
  await NodeFSP.mkdir(directory, { recursive: true });
  const name = snipFileName(new Date(nowMs));
  const path = NodePath.join(directory, name);
  await NodeFSP.writeFile(path, png, { flag: "wx" });
  return { path, name };
}
