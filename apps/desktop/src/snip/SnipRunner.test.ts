import { assert, it } from "vite-plus/test";

import type { SnipFrame } from "./SnipCompose.ts";
import type { SnipDisplay, SnipWindow } from "./SnipGeometry.ts";
import { runSnip, type SnipRunnerDeps } from "./SnipRunner.ts";

const left: SnipDisplay = {
  id: 1,
  dipBounds: { x: 0, y: 0, width: 100, height: 80 },
  physicalBounds: { x: 0, y: 0, width: 100, height: 80 },
  scaleFactor: 1,
};
const right: SnipDisplay = {
  id: 2,
  dipBounds: { x: 100, y: 0, width: 100, height: 80 },
  physicalBounds: { x: 100, y: 0, width: 200, height: 160 },
  scaleFactor: 2,
};
const windows: ReadonlyArray<SnipWindow> = [
  { id: 7, title: "App", bounds: { x: 10, y: 10, width: 40, height: 30 } },
];

function makeDeps(overrides: Partial<SnipRunnerDeps> & Pick<SnipRunnerDeps, "pick">) {
  const calls = { saved: [] as Buffer[], released: 0, encoded: [] as SnipFrame[] };
  const deps: SnipRunnerDeps = {
    displays: [left, right],
    captureFrames: async () =>
      new Map<number, SnipFrame>([
        [1, { width: 100, height: 80, bgra: Buffer.alloc(100 * 80 * 4, 1) }],
        [2, { width: 200, height: 160, bgra: Buffer.alloc(200 * 160 * 4, 2) }],
      ]),
    listWindows: () => windows,
    encodePng: (frame) => {
      calls.encoded.push(frame);
      return Buffer.from("png-bytes");
    },
    save: async (png) => {
      calls.saved.push(png);
      return { path: "C:/snips/snip-1.png", name: "snip-1.png" };
    },
    release: () => {
      calls.released += 1;
    },
    ...overrides,
  };
  return { deps, calls };
}

it("saves the hovered window when the user clicks", async () => {
  const { deps, calls } = makeDeps({
    pick: async ({ session }) => {
      session.move({ x: 20, y: 20 });
      session.down({ x: 20, y: 20 });
      return session.up({ x: 20, y: 20 }) ?? session.cancel();
    },
  });
  const result = await runSnip(deps);
  assert.strictEqual(result.status, "saved");
  if (result.status !== "saved") return;
  assert.strictEqual(result.width, 40);
  assert.strictEqual(result.height, 30);
  assert.strictEqual(result.path, "C:/snips/snip-1.png");
  assert.strictEqual(
    result.dataUrl,
    `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`,
  );
  assert.strictEqual(calls.saved.length, 1);
  assert.strictEqual(calls.released, 1);
});

it("saves a region dragged across two displays at the true pixel size", async () => {
  const { deps, calls } = makeDeps({
    pick: async ({ session }) => {
      session.down({ x: 80, y: 10 });
      return session.up({ x: 160, y: 50 }) ?? session.cancel();
    },
  });
  const result = await runSnip(deps);
  assert.strictEqual(result.status, "saved");
  if (result.status !== "saved") return;
  assert.strictEqual(result.width, 80);
  assert.strictEqual(result.height, 40);
  const frame = calls.encoded[0];
  // First 20 columns come from the left display (value 1), the rest from the right (value 2).
  assert.strictEqual(frame?.bgra[0], 1);
  assert.strictEqual(frame?.bgra[30 * 4], 2);
});

it("saves nothing when the user cancels", async () => {
  const { deps, calls } = makeDeps({ pick: async ({ session }) => session.cancel() });
  assert.deepStrictEqual(await runSnip(deps), { status: "cancelled" });
  assert.strictEqual(calls.saved.length, 0);
  assert.strictEqual(calls.released, 1);
});

it("releases the frames when the overlay fails", async () => {
  const { deps, calls } = makeDeps({
    pick: async () => {
      throw new Error("overlay crashed");
    },
  });
  let message = "";
  try {
    await runSnip(deps);
  } catch (error) {
    message = error instanceof Error ? error.message : "";
  }
  assert.strictEqual(message, "overlay crashed");
  assert.strictEqual(calls.released, 1);
});

it("still returns the image when the disk write fails", async () => {
  const { deps } = makeDeps({
    pick: async ({ session }) => {
      session.down({ x: 20, y: 20 });
      return session.up({ x: 20, y: 20 }) ?? session.cancel();
    },
    save: async () => {
      throw new Error("disk full");
    },
  });
  const result = await runSnip(deps);
  assert.strictEqual(result.status, "saved");
  if (result.status !== "saved") return;
  assert.strictEqual(result.path, "");
  assert.strictEqual(result.name, "snip.png");
});

it("cancels when no display could be captured", async () => {
  const { deps, calls } = makeDeps({
    captureFrames: async () => new Map(),
    pick: async ({ session }) => session.cancel(),
  });
  assert.deepStrictEqual(await runSnip(deps), { status: "cancelled" });
  assert.strictEqual(calls.released, 1);
});
