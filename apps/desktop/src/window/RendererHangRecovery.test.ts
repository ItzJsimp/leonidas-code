import { describe, expect, it } from "@effect/vitest";

import {
  INITIAL_RENDERER_HANG_STATE,
  markRendererRecovered,
  RENDERER_HANG_COOLDOWN_MS,
  RENDERER_HANG_MS,
  RENDERER_HANG_TICK_GAP_MS,
  stepRendererHangWatch,
  type RendererHangState,
} from "./RendererHangRecovery.ts";

const TICK = 5_000;

/** Walks the watch forward in 5 s ticks; `answers` says when the renderer last replied. */
function walk(ticks: number, answersUntilMs: number, start: RendererHangState) {
  let state = start;
  const decisions: string[] = [];
  for (let i = 1; i <= ticks; i += 1) {
    const nowMs = 1_000 + i * TICK;
    const answered = nowMs <= answersUntilMs ? { ...state, lastAnswerAtMs: nowMs } : state;
    const step = stepRendererHangWatch(answered, nowMs);
    state = step.state;
    decisions.push(step.decision);
  }
  return { state, decisions };
}

describe("stepRendererHangWatch", () => {
  it("never recovers a renderer that keeps answering", () => {
    const { decisions } = walk(60, Number.POSITIVE_INFINITY, INITIAL_RENDERER_HANG_STATE);
    expect(decisions.every((decision) => decision === "wait")).toBe(true);
  });

  it("recovers once the renderer has been silent for the hang time", () => {
    // The first tick starts the clock at 6 s; the renderer never answers after that.
    const { decisions } = walk(20, 0, INITIAL_RENDERER_HANG_STATE);
    const first = decisions.indexOf("recover");
    expect(first).toBeGreaterThan(0);
    const silentMs = (first + 1) * TICK - TICK;
    expect(silentMs).toBeGreaterThanOrEqual(RENDERER_HANG_MS);
    expect(silentMs - TICK).toBeLessThan(RENDERER_HANG_MS);
  });

  it("does not recover again inside the cooldown", () => {
    const recovered = markRendererRecovered(INITIAL_RENDERER_HANG_STATE, 1_000);
    const ticks = Math.floor((RENDERER_HANG_COOLDOWN_MS - 1_000) / TICK) - 1;
    expect(walk(ticks, 0, recovered).decisions).not.toContain("recover");
  });

  it("treats a long gap between ticks (sleep) as a fresh start, not a hang", () => {
    const state = { lastAnswerAtMs: 1_000, lastTickAtMs: 1_000, lastRecoveryAtMs: null };
    const wake = 1_000 + RENDERER_HANG_TICK_GAP_MS + 1;
    const step = stepRendererHangWatch(state, wake);
    expect(step.decision).toBe("wait");
    expect(step.state.lastAnswerAtMs).toBe(wake);
  });

  it("starts its clock at the first tick", () => {
    const step = stepRendererHangWatch(INITIAL_RENDERER_HANG_STATE, 50_000);
    expect(step.decision).toBe("wait");
    expect(step.state.lastAnswerAtMs).toBe(50_000);
  });
});
