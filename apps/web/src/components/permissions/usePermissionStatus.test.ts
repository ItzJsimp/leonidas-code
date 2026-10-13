import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { reactHookHarness as hooks } from "../../test/reactHookHarness";
import { usePermissionStatus } from "./usePermissionStatus";

const effects = vi.hoisted(() => [] as Array<() => (() => void) | undefined>);
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return {
    ...actual,
    useRef: reactHookHarness.useRef,
    useState: reactHookHarness.useState,
    useEffect: (effect: () => (() => void) | undefined) => effects.push(effect),
    useEffectEvent: <T>(callback: T) => callback,
  };
});
vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});
const check = vi.fn<() => Promise<{ screen: boolean; accessibility: boolean }>>();
let cleanup: (() => void) | undefined;
let page: EventTarget & { visibilityState: string };
const render = () => {
  hooks.beginRender();
  return usePermissionStatus(check, { screen: false, accessibility: false });
};
beforeEach(() => {
  hooks.reset();
  effects.length = 0;
  vi.useFakeTimers();
  page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { setInterval, clearInterval }));
  check.mockReset().mockResolvedValue({ screen: false, accessibility: false });
});
afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const start = async () => {
  effects.length = 0;
  render();
  const cleanups = effects.map((effect) => effect());
  cleanup = () => cleanups.forEach((done) => done?.());
  await Promise.resolve();
};

it("unlocks Continue only for required grants", async () => {
  await start();
  expect(render().isReady(["screen"])).toBe(false);
  check.mockResolvedValue({ screen: true, accessibility: false });
  await vi.advanceTimersByTimeAsync(1500);
  expect(render().isReady(["screen"])).toBe(true);
  expect(render().isReady(["screen", "accessibility"])).toBe(false);
  check.mockResolvedValue({ screen: true, accessibility: true });
  await vi.advanceTimersByTimeAsync(1500);
  expect(render().isReady(["screen", "accessibility"])).toBe(true);
});

it("does not overlap checks and discards completion after closing", async () => {
  let resolve!: (status: { screen: boolean; accessibility: boolean }) => void;
  const promise = new Promise<{ screen: boolean; accessibility: boolean }>((done) => {
    resolve = done;
  });
  check.mockReturnValue(promise);
  await start();
  await vi.advanceTimersByTimeAsync(4500);
  expect(check).toHaveBeenCalledTimes(1);
  cleanup?.();
  resolve({ screen: true, accessibility: true });
  await promise;
  expect(render().isReady(["screen"])).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("pauses in the background and blocks stale grants after a check failure", async () => {
  check.mockResolvedValue({ screen: true, accessibility: true });
  await start();
  expect(render().isReady(["screen"])).toBe(true);
  page.visibilityState = "hidden";
  await vi.advanceTimersByTimeAsync(3000);
  expect(check).toHaveBeenCalledTimes(1);
  check.mockRejectedValue(new Error("IPC unavailable"));
  page.visibilityState = "visible";
  page.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(render().isReady(["screen"])).toBe(false);
  check.mockResolvedValue({ screen: true, accessibility: true });
  await vi.advanceTimersByTimeAsync(1500);
  expect(render().isReady(["screen"])).toBe(true);
});
