import { assert, it } from "vite-plus/test";

import {
  SNIP_DRAG_THRESHOLD_PX,
  cropPiecesForRect,
  dipToPhysicalPoint,
  hitTestWindow,
  interpretGesture,
  newestSnips,
  type SnipDisplay,
  type SnipWindow,
} from "./SnipGeometry.ts";

// Left display: 1920x1080 at 100%. Right display: 3840x2160 physical at 150% (2560x1440 DIP).
const left: SnipDisplay = {
  id: 1,
  dipBounds: { x: 0, y: 0, width: 1920, height: 1080 },
  physicalBounds: { x: 0, y: 0, width: 1920, height: 1080 },
  scaleFactor: 1,
};
const right: SnipDisplay = {
  id: 2,
  dipBounds: { x: 1920, y: 0, width: 2560, height: 1440 },
  physicalBounds: { x: 1920, y: 0, width: 3840, height: 2160 },
  scaleFactor: 1.5,
};
const displays = [left, right];

const win = (id: number, x: number, y: number, width: number, height: number): SnipWindow => ({
  id,
  title: `w${String(id)}`,
  bounds: { x, y, width, height },
});

it("hit-tests the top window first when windows overlap", () => {
  const windows = [win(1, 100, 100, 400, 400), win(2, 0, 0, 1000, 1000)];
  assert.strictEqual(hitTestWindow(windows, displays, { x: 200, y: 200 })?.id, 1);
  assert.strictEqual(hitTestWindow(windows, displays, { x: 800, y: 800 })?.id, 2);
});

it("treats the right and bottom edge as outside the window", () => {
  const windows = [win(1, 100, 100, 400, 400)];
  assert.strictEqual(hitTestWindow(windows, displays, { x: 100, y: 100 })?.id, 1);
  assert.strictEqual(hitTestWindow(windows, displays, { x: 500, y: 300 }), undefined);
  assert.strictEqual(hitTestWindow(windows, displays, { x: 300, y: 500 }), undefined);
});

it("clips a maximized window to its display so the border never spills over", () => {
  const windows = [win(1, -8, -8, 1936, 1096)];
  const hit = hitTestWindow(windows, displays, { x: 10, y: 10 });
  assert.deepStrictEqual(hit?.bounds, { x: 0, y: 0, width: 1920, height: 1080 });
});

it("returns undefined for an empty window list", () => {
  assert.strictEqual(hitTestWindow([], displays, { x: 1, y: 1 }), undefined);
});

it("converts a DIP point to physical pixels with each display scale", () => {
  assert.deepStrictEqual(dipToPhysicalPoint(displays, { x: 100, y: 50 }), { x: 100, y: 50 });
  // 100 DIP into the right display = 150 physical pixels past its physical origin.
  assert.deepStrictEqual(dipToPhysicalPoint(displays, { x: 2020, y: 100 }), { x: 2070, y: 150 });
});

it("snaps a point outside every display to the nearest display", () => {
  const point = dipToPhysicalPoint(displays, { x: -50, y: 10 });
  assert.deepStrictEqual(point, { x: 0, y: 10 });
});

it("reads a small movement as a click and a large one as a drag", () => {
  const down = { x: 100, y: 100 };
  const click = interpretGesture(down, { x: 100 + SNIP_DRAG_THRESHOLD_PX - 1, y: 100 });
  assert.strictEqual(click.kind, "click");
  const drag = interpretGesture(down, { x: 100 + SNIP_DRAG_THRESHOLD_PX, y: 100 });
  assert.strictEqual(drag.kind, "drag");
});

it("normalizes a drag made up and to the left", () => {
  const gesture = interpretGesture({ x: 300, y: 300 }, { x: 100, y: 200 });
  assert.deepStrictEqual(gesture.rect, { x: 100, y: 200, width: 200, height: 100 });
});

it("crops inside one display relative to that display's frozen image", () => {
  const pieces = cropPiecesForRect(displays, { x: 2000, y: 100, width: 300, height: 200 });
  assert.deepStrictEqual(pieces, [
    {
      displayId: 2,
      source: { x: 80, y: 100, width: 300, height: 200 },
      destination: { x: 0, y: 0 },
    },
  ]);
});

it("splits a rectangle that crosses two displays into two pieces", () => {
  const pieces = cropPiecesForRect(displays, { x: 1820, y: 0, width: 200, height: 100 });
  assert.deepStrictEqual(pieces, [
    {
      displayId: 1,
      source: { x: 1820, y: 0, width: 100, height: 100 },
      destination: { x: 0, y: 0 },
    },
    {
      displayId: 2,
      source: { x: 0, y: 0, width: 100, height: 100 },
      destination: { x: 100, y: 0 },
    },
  ]);
});

it("returns no pieces for an empty rectangle", () => {
  assert.deepStrictEqual(cropPiecesForRect(displays, { x: 10, y: 10, width: 0, height: 5 }), []);
});

it("lists the newest 12 snips, newest first, and ignores other files", () => {
  const files = Array.from({ length: 15 }, (_, index) => ({
    name: `snip-${String(index)}.png`,
    modifiedMs: 1000 + index,
  }));
  const list = newestSnips([...files, { name: "notes.txt", modifiedMs: 9999 }]);
  assert.strictEqual(list.length, 12);
  assert.strictEqual(list[0]?.name, "snip-14.png");
  assert.strictEqual(list[11]?.name, "snip-3.png");
});

it("keeps an empty snip list empty", () => {
  assert.deepStrictEqual(newestSnips([]), []);
});
