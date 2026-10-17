import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { assert, beforeEach, it, vi } from "vite-plus/test";

import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";

const mocks = vi.hoisted(() => ({
  runSnip: vi.fn(),
  release: vi.fn(),
  loadWindowListApi: vi.fn(),
}));

vi.mock("./SnipRunner.ts", () => ({ runSnip: mocks.runSnip }));
vi.mock("./SnipOverlay.ts", () => ({
  makeSnipOverlay: () => ({ pick: vi.fn(), release: mocks.release }),
}));
vi.mock("./WindowList.ts", () => ({
  loadWindowListApi: mocks.loadWindowListApi,
  listVisibleWindows: vi.fn(),
}));
vi.mock("./SnipElectron.ts", () => ({
  captureSnipFrames: vi.fn(),
  encodeSnipPng: vi.fn(),
  openSnipsDirectory: vi.fn(),
  readSnipDisplays: () => [],
  readSnipImage: vi.fn(),
  saveSnipPng: vi.fn(),
  snipThumbnailDataUrl: vi.fn(),
}));

import * as DesktopSnip from "./DesktopSnip.ts";

const environment = Layer.succeed(
  DesktopEnvironment.DesktopEnvironment,
  DesktopEnvironment.DesktopEnvironment.of({
    stateDir: "/state",
    dirname: "/app",
  } as DesktopEnvironment.DesktopEnvironment["Service"]),
);
const layer = DesktopSnip.layer.pipe(Layer.provide(Layer.merge(environment, Path.layer)));

const run = <A, E>(
  effect: Effect.Effect<A, E, DesktopSnip.DesktopSnip>,
  platform: NodeJS.Platform = "win32",
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(layer), Effect.provideService(HostProcess.Platform, platform)),
  );

beforeEach(() => {
  mocks.runSnip.mockReset();
  mocks.release.mockReset();
  mocks.loadWindowListApi.mockReset().mockResolvedValue({});
});

it("returns the saved snip and frees the overlay", async () => {
  const saved = {
    status: "saved",
    path: "/state/snips/a.png",
    name: "a.png",
    width: 1,
    height: 1,
    dataUrl: "data:image/png;base64,AA==",
  };
  mocks.runSnip.mockResolvedValue(saved);
  const result = await run(Effect.flatMap(DesktopSnip.DesktopSnip, (s) => s.start));
  assert.deepStrictEqual(result, saved);
  assert.strictEqual(mocks.release.mock.calls.length, 1);
});

it("fails with a plain error on a system other than Windows", async () => {
  const error = await run(
    Effect.flip(Effect.flatMap(DesktopSnip.DesktopSnip, (s) => s.start)),
    "linux",
  );
  assert.strictEqual(error._tag, "DesktopSnipError");
  assert.strictEqual(error.operation, "unsupported");
  assert.strictEqual(mocks.runSnip.mock.calls.length, 0);
});

it("maps a capture failure to a snip error and still frees the overlay", async () => {
  mocks.runSnip.mockRejectedValue(new Error("No screen could be captured."));
  const error = await run(Effect.flip(Effect.flatMap(DesktopSnip.DesktopSnip, (s) => s.start)));
  assert.strictEqual(error.operation, "capture");
  assert.strictEqual(mocks.release.mock.calls.length, 1);
});

it("cancels a second start while the first overlay is open, then allows a new one", async () => {
  let finishFirst: (value: unknown) => void = () => undefined;
  mocks.runSnip.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
  const program = Effect.gen(function* () {
    const service = yield* DesktopSnip.DesktopSnip;
    const first = yield* Effect.forkChild(service.start, { startImmediately: true });
    yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 20)));
    const second = yield* service.start;
    finishFirst({ status: "cancelled" });
    yield* Fiber.join(first);
    mocks.runSnip.mockResolvedValueOnce({ status: "cancelled" });
    const third = yield* service.start;
    return { second, third, calls: mocks.runSnip.mock.calls.length };
  });
  const outcome = await run(Effect.scoped(program));
  assert.deepStrictEqual(outcome.second, { status: "cancelled" });
  assert.deepStrictEqual(outcome.third, { status: "cancelled" });
  assert.strictEqual(outcome.calls, 2);
});
