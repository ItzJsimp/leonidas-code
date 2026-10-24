import { WORKSPACE_PICTURE_MAX_BYTES } from "@t3tools/contracts";

/** The personal Leonidas workspace shows the app icon until its owner picks a picture. */
const LEONIDAS_WORKSPACE_ID = "leonidas";
export const LEONIDAS_DEFAULT_PICTURE = "/apple-touch-icon.png";

export const WORKSPACE_PICTURE_UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

/** The picture to draw for a workspace, or null to draw its first letter. */
export function workspacePictureUrl(
  pictures: Readonly<Record<string, string>>,
  workspaceId: string | null | undefined,
): string | null {
  if (workspaceId && Object.hasOwn(pictures, workspaceId)) return pictures[workspaceId]!;
  // No workspace at all is the plain Leonidas app, which wears the same icon.
  return !workspaceId || workspaceId === LEONIDAS_WORKSPACE_ID ? LEONIDAS_DEFAULT_PICTURE : null;
}

/** The largest centered square of an image: what a round avatar shows. */
export function centerSquare(
  width: number,
  height: number,
): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

export function validatePictureFile(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!WORKSPACE_PICTURE_UPLOAD_TYPES.includes(file.type)) {
    return "Choose a PNG, JPEG, WebP or GIF image.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > UPLOAD_MAX_BYTES) return "Choose an image smaller than 20 MB.";
  return null;
}

/** Base64 payload size of a data URL, so the client can refuse what the server would. */
export function dataUrlByteLength(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

export function fitsPictureLimit(dataUrl: string): boolean {
  return dataUrlByteLength(dataUrl) <= WORKSPACE_PICTURE_MAX_BYTES;
}
