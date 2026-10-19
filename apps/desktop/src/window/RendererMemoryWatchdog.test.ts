import { describe, expect, it } from "@effect/vitest";

import {
  INITIAL_RENDERER_MEMORY_WATCHDOG_STATE,
  markRendererReloaded,
  RENDERER_MEMORY_LIMIT_BYTES,
  RENDERER_RELOAD_COOLDOWN_MS,
  RENDERER_RELOAD_IDLE_SECONDS,
  stepRendererMemoryWatchdog,
  type RendererMemorySample,
  type RendererMemoryWatchdogState,
} from "./RendererMemoryWatchdog.ts";

const OVER = RENDERER_MEMORY_LIMIT_BYTES + 1;
const UNDER = RENDERER_MEMORY_LIMIT_BYTES - 1;

const away = (nowMs: number, rendererBytes = OVER): RendererMemorySample => ({
  nowMs,
  rendererBytes,
  systemIdleSeconds: RENDERER_RELOAD_IDLE_SECONDS,
  windowVisible: true,
});

function run(
  samples: ReadonlyArray<RendererMemorySample>,
  state: RendererMemoryWatchdogState = INITIAL_RENDERER_MEMORY_WATCHDOG_STATE,
) {
  const decisions: string[] = [];
  for (const sample of samples) {
    const step = stepRendererMemoryWatchdog(state, sample);
    state = step.state;
    decisions.push(step.decision);
  }
  return { state, decisions };
}

describe("stepRendererMemoryWatchdog", () => {
  it("asks the renderer only after 3 samples in a row over the limit", () => {
    const { decisions } = run([away(1), away(2), away(3)]);
    expect(decisions).toEqual(["wait", "wait", "check-renderer"]);
  });

  it("restarts the count when one sample drops under the limit", () => {
    const { decisions } = run([away(1), away(2), away(3, UNDER), away(4), away(5)]);
    expect(decisions).toEqual(["wait", "wait", "wait", "wait", "wait"]);
  });

  it("waits while the user is active in a visible window", () => {
    const active = (nowMs: number) => ({ ...away(nowMs), systemIdleSeconds: 30 });
    const { decisions } = run([active(1), active(2), active(3)]);
    expect(decisions).toEqual(["wait", "wait", "wait"]);
  });

  it("acts on a hidden window even when the system is not idle", () => {
    const hidden = (nowMs: number) => ({
      ...away(nowMs),
      systemIdleSeconds: 0,
      windowVisible: false,
    });
    const { decisions } = run([hidden(1), hidden(2), hidden(3)]);
    expect(decisions.at(-1)).toBe("check-renderer");
  });

  it("keeps asking on later samples when the renderer says it is busy", () => {
    const { decisions } = run([away(1), away(2), away(3), away(4)]);
    expect(decisions.slice(2)).toEqual(["check-renderer", "check-renderer"]);
  });

  it("does not reload again inside the cooldown", () => {
    const reloaded = markRendererReloaded(INITIAL_RENDERER_MEMORY_WATCHDOG_STATE, 1_000);
    const soon = 1_000 + RENDERER_RELOAD_COOLDOWN_MS - 1;
    const later = 1_000 + RENDERER_RELOAD_COOLDOWN_MS;
    expect(run([away(soon), away(soon), away(soon)], reloaded).decisions.at(-1)).toBe("wait");
    expect(run([away(later), away(later), away(later)], reloaded).decisions.at(-1)).toBe(
      "check-renderer",
    );
  });

  it("clears the count after a reload", () => {
    const state = markRendererReloaded({ overLimitSamples: 5, lastReloadAtMs: null }, 9);
    expect(state).toEqual({ overLimitSamples: 0, lastReloadAtMs: 9 });
  });
});
