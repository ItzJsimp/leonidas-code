import { assert, it } from "vite-plus/test";

import { listVisibleWindows, type WindowListApi } from "./WindowList.ts";

type FakeWindow = {
  readonly handle: bigint;
  readonly title?: string;
  readonly className?: string;
  readonly visible?: boolean;
  readonly minimized?: boolean;
  readonly cloaked?: boolean;
  readonly rect?: { x: number; y: number; width: number; height: number } | undefined;
};

function fakeApi(windows: ReadonlyArray<FakeWindow>): WindowListApi {
  const byHandle = new Map(windows.map((window) => [window.handle, window]));
  return {
    getTopWindow: () => windows[0]?.handle ?? 0n,
    getNextWindow: (handle) => {
      const index = windows.findIndex((window) => window.handle === handle);
      return windows[index + 1]?.handle ?? 0n;
    },
    isVisible: (handle) => byHandle.get(handle)?.visible ?? true,
    isMinimized: (handle) => byHandle.get(handle)?.minimized ?? false,
    isCloaked: (handle) => byHandle.get(handle)?.cloaked ?? false,
    getRect: (handle) => {
      const window = byHandle.get(handle);
      return window && "rect" in window ? window.rect : { x: 0, y: 0, width: 100, height: 100 };
    },
    getTitle: (handle) => byHandle.get(handle)?.title ?? `window ${String(handle)}`,
    getClassName: (handle) => byHandle.get(handle)?.className ?? "Chrome_WidgetWin_1",
  };
}

it("returns windows from the top of the z-order down", () => {
  const list = listVisibleWindows(fakeApi([{ handle: 3n }, { handle: 2n }, { handle: 1n }]));
  assert.deepStrictEqual(
    list.map((window) => window.id),
    [3, 2, 1],
  );
});

it("skips hidden, minimized and cloaked windows", () => {
  const list = listVisibleWindows(
    fakeApi([
      { handle: 1n, visible: false },
      { handle: 2n, minimized: true },
      { handle: 3n, cloaked: true },
      { handle: 4n },
    ]),
  );
  assert.deepStrictEqual(
    list.map((window) => window.id),
    [4],
  );
});

it("skips windows with no area or no rectangle", () => {
  const list = listVisibleWindows(
    fakeApi([
      { handle: 1n, rect: { x: 0, y: 0, width: 0, height: 50 } },
      { handle: 2n, rect: undefined },
      { handle: 3n },
    ]),
  );
  assert.deepStrictEqual(
    list.map((window) => window.id),
    [3],
  );
});

it("skips untitled helper windows but keeps the taskbar", () => {
  const list = listVisibleWindows(
    fakeApi([
      { handle: 1n, title: "", className: "SomeHelper" },
      { handle: 2n, title: "", className: "Shell_TrayWnd" },
    ]),
  );
  assert.deepStrictEqual(
    list.map((window) => window.id),
    [2],
  );
});

it("skips excluded handles such as the overlay windows", () => {
  const list = listVisibleWindows(fakeApi([{ handle: 1n }, { handle: 2n }]), {
    excludeIds: new Set([1]),
  });
  assert.deepStrictEqual(
    list.map((window) => window.id),
    [2],
  );
});

it("returns an empty list when there are no windows", () => {
  assert.deepStrictEqual(listVisibleWindows(fakeApi([])), []);
});

it("stops on a loop in the z-order chain", () => {
  const api: WindowListApi = {
    ...fakeApi([{ handle: 1n }]),
    getNextWindow: () => 1n,
  };
  assert.strictEqual(listVisibleWindows(api).length, 1);
});

it("returns what it has when the native call throws midway", () => {
  const base = fakeApi([{ handle: 1n }, { handle: 2n }]);
  const api: WindowListApi = {
    ...base,
    getTitle: (handle) => {
      if (handle === 2n) throw new Error("native failure");
      return "ok";
    },
  };
  assert.deepStrictEqual(
    listVisibleWindows(api).map((window) => window.id),
    [1],
  );
});
