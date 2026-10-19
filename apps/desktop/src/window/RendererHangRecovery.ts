import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";

import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronWindow from "../electron/ElectronWindow.ts";

/*
  A busy renderer (measured: 1.2 GB gained in 8 minutes, 95 CPU seconds in
  the first 3 minutes after launch) freezes the window, and the idle-only
  memory watchdog never acts while the user sits at the PC. This watch pings
  the main window every few seconds. After HANG_MS without an answer it logs
  the open screen, CPU and memory, then force-reloads the window. A CPU
  profile cannot be taken: profiler commands time out on a stuck page.
  Turns run in the server process, so a reload interrupts no agent work.
*/
export const RENDERER_HANG_MS = 30_000;
export const RENDERER_HANG_COOLDOWN_MS = 3 * 60_000;
// A gap this long between ticks means the PC slept; the ping could not run.
export const RENDERER_HANG_TICK_GAP_MS = 15_000;
const TICK_INTERVAL = Duration.seconds(5);
// A reload sent before the renderer reports its crash does nothing.
const CRASH_REPORT_TIMEOUT = Duration.seconds(10);

export interface RendererHangState {
  readonly lastAnswerAtMs: number | null;
  readonly lastTickAtMs: number | null;
  readonly lastRecoveryAtMs: number | null;
}

export const INITIAL_RENDERER_HANG_STATE: RendererHangState = {
  lastAnswerAtMs: null,
  lastTickAtMs: null,
  lastRecoveryAtMs: null,
};

export function stepRendererHangWatch(
  state: RendererHangState,
  nowMs: number,
): { readonly state: RendererHangState; readonly decision: "wait" | "recover" } {
  const next = { ...state, lastTickAtMs: nowMs };
  const slept =
    state.lastTickAtMs !== null && nowMs - state.lastTickAtMs > RENDERER_HANG_TICK_GAP_MS;
  if (state.lastAnswerAtMs === null || slept) {
    return { state: { ...next, lastAnswerAtMs: nowMs }, decision: "wait" };
  }
  const coolingDown =
    state.lastRecoveryAtMs !== null && nowMs - state.lastRecoveryAtMs < RENDERER_HANG_COOLDOWN_MS;
  const hung = nowMs - state.lastAnswerAtMs >= RENDERER_HANG_MS;
  return { state: next, decision: hung && !coolingDown ? "recover" : "wait" };
}

export function markRendererRecovered(_state: RendererHangState, nowMs: number): RendererHangState {
  return { lastAnswerAtMs: nowMs, lastTickAtMs: nowMs, lastRecoveryAtMs: nowMs };
}

/** Route only: a pairing token or query string never reaches the log. */
function screenOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "unknown";
  }
}

const make = Effect.gen(function* () {
  const electronApp = yield* ElectronApp.ElectronApp;
  const electronWindow = yield* ElectronWindow.ElectronWindow;
  let state = INITIAL_RENDERER_HANG_STATE;
  let pingInFlight = false;

  const tick = Effect.gen(function* () {
    const main = yield* electronWindow.main;
    if (Option.isNone(main) || main.value.isDestroyed()) {
      state = INITIAL_RENDERER_HANG_STATE;
      return;
    }
    const webContents = main.value.webContents;
    const nowMs = yield* Clock.currentTimeMillis;

    if (!pingInFlight) {
      pingInFlight = true;
      yield* Effect.tryPromise(() => webContents.executeJavaScript("1")).pipe(
        Effect.andThen(Clock.currentTimeMillis),
        Effect.tap((answeredAtMs) =>
          Effect.sync(() => {
            state = { ...state, lastAnswerAtMs: answeredAtMs };
          }),
        ),
        Effect.ignore,
        Effect.ensuring(Effect.sync(() => (pingInFlight = false))),
        Effect.forkScoped,
      );
    }

    const step = stepRendererHangWatch(state, nowMs);
    state = step.state;
    if (step.decision === "wait") return;

    const metric = (yield* electronApp.getAppMetrics).find(
      (entry) => entry.pid === webContents.getOSProcessId(),
    );
    yield* Effect.logWarning("Main window is not answering; reloading it", {
      silentSeconds: Math.round((nowMs - (step.state.lastAnswerAtMs ?? nowMs)) / 1000),
      screen: screenOf(webContents.getURL()),
      rendererMb: metric ? Math.round((metric.memory.privateBytes ?? 0) / 1024) : null,
      rendererCpuPercent: metric ? Math.round(metric.cpu.percentCPUUsage) : null,
    });
    const crashed = new Promise<void>((resolve) =>
      webContents.once("render-process-gone", () => resolve()),
    );
    webContents.forcefullyCrashRenderer();
    yield* Effect.promise(() => crashed).pipe(Effect.timeout(CRASH_REPORT_TIMEOUT), Effect.ignore);
    state = markRendererRecovered(state, yield* Clock.currentTimeMillis);
    if (!webContents.isDestroyed()) webContents.reload();
  });

  yield* tick.pipe(
    Effect.catchCause((cause) => Effect.logWarning("Renderer hang check failed", cause)),
    Effect.repeat(Schedule.spaced(TICK_INTERVAL)),
    Effect.forkScoped,
  );
});

export const layer = Layer.effectDiscard(make);
