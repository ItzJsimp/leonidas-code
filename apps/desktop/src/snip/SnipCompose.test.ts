import { assert, it } from "vite-plus/test";

import { composeBitmap, type SnipFrame } from "./SnipCompose.ts";
import type { SnipCropPiece } from "./SnipGeometry.ts";

/** A frame where every pixel's four bytes equal `value`. */
function frame(width: number, height: number, value: number): SnipFrame {
  return { width, height, bgra: Buffer.alloc(width * height * 4, value) };
}

function pixel(bitmap: Buffer, width: number, x: number, y: number): number {
  return bitmap[(y * width + x) * 4] ?? -1;
}

it("copies one piece out of the middle of a frame", () => {
  const source = frame(4, 4, 7);
  source.bgra.fill(9, (1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4);
  const pieces: SnipCropPiece[] = [
    { displayId: 1, source: { x: 1, y: 1, width: 2, height: 2 }, destination: { x: 0, y: 0 } },
  ];
  const result = composeBitmap(pieces, new Map([[1, source]]), { width: 2, height: 2 });
  assert.strictEqual(result.length, 2 * 2 * 4);
  assert.strictEqual(pixel(result, 2, 0, 0), 9);
  assert.strictEqual(pixel(result, 2, 1, 1), 7);
});

it("places pieces from two displays side by side", () => {
  const pieces: SnipCropPiece[] = [
    { displayId: 1, source: { x: 0, y: 0, width: 2, height: 2 }, destination: { x: 0, y: 0 } },
    { displayId: 2, source: { x: 0, y: 0, width: 2, height: 2 }, destination: { x: 2, y: 0 } },
  ];
  const result = composeBitmap(
    pieces,
    new Map([
      [1, frame(4, 4, 10)],
      [2, frame(4, 4, 20)],
    ]),
    { width: 4, height: 2 },
  );
  assert.strictEqual(pixel(result, 4, 1, 1), 10);
  assert.strictEqual(pixel(result, 4, 2, 1), 20);
});

it("skips a piece whose frame is missing and leaves it transparent", () => {
  const pieces: SnipCropPiece[] = [
    { displayId: 3, source: { x: 0, y: 0, width: 1, height: 1 }, destination: { x: 0, y: 0 } },
  ];
  const result = composeBitmap(pieces, new Map(), { width: 1, height: 1 });
  assert.deepStrictEqual([...result], [0, 0, 0, 0]);
});

it("clips a piece that reaches past the frame instead of reading out of range", () => {
  const pieces: SnipCropPiece[] = [
    { displayId: 1, source: { x: 3, y: 3, width: 4, height: 4 }, destination: { x: 0, y: 0 } },
  ];
  const result = composeBitmap(pieces, new Map([[1, frame(4, 4, 5)]]), { width: 4, height: 4 });
  assert.strictEqual(pixel(result, 4, 0, 0), 5);
  assert.strictEqual(pixel(result, 4, 3, 3), 0);
});
