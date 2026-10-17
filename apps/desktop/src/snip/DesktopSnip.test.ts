import { assert, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { beforeEach, vi } from "vite-plus/test";

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

const withService = <A, E>(
  effect: Effect.Effect<A, E, DesktopSnip.DesktopSnip>,
  platform: NodeJS.Platform = "win32",
) => effect.pipe(Effect.provide(layer), Effect.provideService(HostProcess.Platform, platform));

beforeEach(() => {
  mocks.runSnip.mockReset();
  mocks.release.mockReset();
  mocks.loadWindowListApi.mockReset().mockResolvedValue({});
});

it.effect("returns the saved snip and frees the overlay", () => {
  const saved = {
    status: "saved" as const,
    path: "/state/snips/a.png",
    name: "a.png",
    width: 1,
    height: 1,
    dataUrl: "data:image/png;base64,AA==",
  };
  mocks.runSnip.mockResolvedValue(saved);
  return withService(
    Effect.gen(function* () {
      const result = yield* (yield* DesktopSnip.DesktopSnip).start;
      assert.deepStrictEqual(result, saved);
      assert.strictEqual(mocks.release.mock.calls.length, 1);
    }),
  );
});

it.effect("fails with a plain error on a system other than Windows", () =>
  withService(
    Effect.gen(function* () {
      const error = yield* Effect.flip((yield* DesktopSnip.DesktopSnip).start);
      assert.strictEqual(error.operation, "unsupported");
      assert.strictEqual(mocks.runSnip.mock.calls.length, 0);
    }),
    "linux",
  ),
);

it.effect("maps a capture failure to a snip error and still frees the overlay", () => {
  mocks.runSnip.mockRejectedValue(new Error("No screen could be captured."));
  return withService(
    Effect.gen(function* () {
      const error = yield* Effect.flip((yield* DesktopSnip.DesktopSnip).start);
      assert.strictEqual(error.operation, "capture");
      assert.strictEqual(mocks.release.mock.calls.length, 1);
    }),
  );
});

it.effect("cancels a second start while the first overlay is open, then allows a new one", () => {
  let finishFirst: (value: unknown) => void = () => undefined;
  mocks.runSnip.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
  return withService(
    Effect.gen(function* () {
      const service = yield* DesktopSnip.DesktopSnip;
      // The first start sets the guard before it waits on the overlay.
      const first = yield* Effect.forkChild(service.start, { startImmediately: true });
      const second = yield* service.start;
      assert.deepStrictEqual(second, { status: "cancelled" });
      // The runner starts after the window list loads, so wait until it is waiting on the overlay.
      yield* Effect.promise(() =>
        vi.waitFor(() => assert.strictEqual(mocks.runSnip.mock.calls.length, 1)),
      );
      finishFirst({ status: "cancelled" });
      yield* Fiber.join(first);
      mocks.runSnip.mockResolvedValueOnce({ status: "cancelled" });
      const third = yield* service.start;
      assert.deepStrictEqual(third, { status: "cancelled" });
      assert.strictEqual(mocks.runSnip.mock.calls.length, 2);
    }),
  );
});
