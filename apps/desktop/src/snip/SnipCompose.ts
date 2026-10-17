// Builds the final image from per-display crops. Works on raw BGRA bitmaps, one row copy at a time.
import type { SnipCropPiece } from "./SnipGeometry.ts";

export type SnipFrame = {
  readonly width: number;
  readonly height: number;
  /** 4 bytes per pixel, row after row, no padding. */
  readonly bgra: Buffer;
};

export function composeBitmap(
  pieces: ReadonlyArray<SnipCropPiece>,
  frames: ReadonlyMap<number, SnipFrame>,
  size: { readonly width: number; readonly height: number },
): Buffer {
  const output = Buffer.alloc(size.width * size.height * 4);
  for (const piece of pieces) {
    const frame = frames.get(piece.displayId);
    if (!frame) continue;
    const width = Math.min(
      piece.source.width,
      frame.width - piece.source.x,
      size.width - piece.destination.x,
    );
    const height = Math.min(
      piece.source.height,
      frame.height - piece.source.y,
      size.height - piece.destination.y,
    );
    if (width <= 0 || height <= 0) continue;
    for (let row = 0; row < height; row += 1) {
      const from = ((piece.source.y + row) * frame.width + piece.source.x) * 4;
      const to = ((piece.destination.y + row) * size.width + piece.destination.x) * 4;
      frame.bgra.copy(output, to, from, from + width * 4);
    }
  }
  return output;
}
