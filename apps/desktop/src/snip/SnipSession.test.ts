import { assert, it } from "vite-plus/test";

import { createSnipSession } from "./SnipSession.ts";
import type { SnipDisplay, SnipWindow } from "./SnipGeometry.ts";

const display: SnipDisplay = {
  id: 1,
  dipBounds: { x: 0, y: 0, width: 1000, height: 800 },
  physicalBounds: { x: 0, y: 0, width: 1000, height: 800 },
  scaleFactor: 1,
};
const windows: ReadonlyArray<SnipWindow> = [
  { id: 1, title: "Front", bounds: { x: 100, y: 100, width: 300, height: 200 } },
  { id: 2, title: "Back", bounds: { x: 0, y: 0, width: 800, height: 600 } },
];

it("highlights the top window under the pointer", () => {
  const session = createSnipSession({ displays: [display], windows });
  const view = session.move({ x: 150, y: 150 });
  assert.deepStrictEqual(view.highlight, { x: 100, y: 100, width: 300, height: 200 });
  assert.strictEqual(view.label, "Front");
  assert.strictEqual(view.selection, undefined);
});

it("clears the highlight over empty desktop", () => {
  const session = createSnipSession({ displays: [display], windows });
  assert.strictEqual(session.move({ x: 950, y: 750 }).highlight, undefined);
});

it("selects the hovered window on a click", () => {
  const session = createSnipSession({ displays: [display], windows });
  session.move({ x: 150, y: 150 });
  session.down({ x: 150, y: 150 });
  const outcome = session.up({ x: 151, y: 150 });
  assert.deepStrictEqual(outcome, {
    kind: "selected",
    rect: { x: 100, y: 100, width: 300, height: 200 },
  });
});

it("selects a dragged region and ignores the window under it", () => {
  const session = createSnipSession({ displays: [display], windows });
  session.down({ x: 500, y: 400 });
  const view = session.move({ x: 300, y: 300 });
  assert.deepStrictEqual(view.selection, { x: 300, y: 300, width: 200, height: 100 });
  assert.strictEqual(view.highlight, undefined);
  const outcome = session.up({ x: 300, y: 300 });
  assert.deepStrictEqual(outcome, {
    kind: "selected",
    rect: { x: 300, y: 300, width: 200, height: 100 },
  });
});

it("keeps waiting when the user clicks empty desktop", () => {
  const session = createSnipSession({ displays: [display], windows });
  session.down({ x: 950, y: 750 });
  assert.strictEqual(session.up({ x: 950, y: 750 }), undefined);
});

it("cancels on Esc and stays cancelled", () => {
  const session = createSnipSession({ displays: [display], windows });
  assert.deepStrictEqual(session.cancel(), { kind: "cancelled" });
  session.down({ x: 150, y: 150 });
  assert.strictEqual(session.up({ x: 150, y: 150 }), undefined);
});

it("ignores a pointer release that never had a press", () => {
  const session = createSnipSession({ displays: [display], windows });
  assert.strictEqual(session.up({ x: 150, y: 150 }), undefined);
});

it("allows a second selection attempt after an empty click", () => {
  const session = createSnipSession({ displays: [display], windows });
  session.down({ x: 950, y: 750 });
  session.up({ x: 950, y: 750 });
  session.down({ x: 150, y: 150 });
  const outcome = session.up({ x: 150, y: 150 });
  assert.strictEqual(outcome?.kind, "selected");
});

it("keeps the drag inside the displays", () => {
  const session = createSnipSession({ displays: [display], windows });
  session.down({ x: 900, y: 700 });
  const outcome = session.up({ x: 1400, y: 1000 });
  assert.deepStrictEqual(outcome, {
    kind: "selected",
    rect: { x: 900, y: 700, width: 100, height: 100 },
  });
});
