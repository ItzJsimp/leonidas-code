import type { DesktopBridge, DesktopSnipResult } from "@t3tools/contracts";

import { dataUrlToFile } from "./imageCompression";
import { isWindowsPlatform } from "./utils";

type SnipMethods = "startSnip" | "listRecentSnips" | "readSnip" | "openSnipsFolder";

export type DesktopSnipBridge = DesktopBridge & Required<Pick<DesktopBridge, SnipMethods>>;

/** The snip tool needs the desktop app and Windows for now. */
export function getDesktopSnipBridge(): DesktopSnipBridge | undefined {
  if (typeof window === "undefined") return undefined;
  if (!isWindowsPlatform(window.navigator.platform)) return undefined;
  const bridge = window.desktopBridge;
  if (
    typeof bridge?.startSnip !== "function" ||
    typeof bridge.listRecentSnips !== "function" ||
    typeof bridge.readSnip !== "function" ||
    typeof bridge.openSnipsFolder !== "function"
  ) {
    return undefined;
  }
  return bridge as DesktopSnipBridge;
}

/** Turns a saved snip into a file for the composer. A cancelled snip gives null. */
export function snipResultToFile(result: DesktopSnipResult): File | null {
  if (result.status !== "saved") return null;
  return dataUrlToFile(result.dataUrl, result.name, "image/png");
}
