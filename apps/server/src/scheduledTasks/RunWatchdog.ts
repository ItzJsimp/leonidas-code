import type { OrchestrationV2RunStatus } from "@t3tools/contracts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

export const DEFAULT_IDLE_LIMIT_MS = 600_000;

/**
 * How long a scheduled run may sit without activity before it is interrupted.
 * Set T3CODE_SCHEDULED_TASK_IDLE_LIMIT_SECONDS; 0 turns the watchdog off.
 */
export class ScheduledTaskIdleLimit extends Context.Reference<Effect.Effect<number>>(
  "t3/scheduledTasks/ScheduledTaskIdleLimit",
  {
    defaultValue: () =>
      Config.Int("T3CODE_SCHEDULED_TASK_IDLE_LIMIT_SECONDS").pipe(
        Config.withDefault(DEFAULT_IDLE_LIMIT_MS / 1000),
        Effect.map((seconds) => seconds * 1000),
        Effect.orElseSucceed(() => DEFAULT_IDLE_LIMIT_MS),
      ),
  },
) {}

const MIN_POLL_MS = 1_000;
const MAX_POLL_MS = 15_000;

/** A run that has not ended; `lastActivityMs` is the newest sign of progress. */
export interface RunActivity {
  readonly status: OrchestrationV2RunStatus;
  readonly lastActivityMs: number;
}

export type RunWatchdogOutcome = "ended" | "interrupted";

// A queued or preparing run waits on something else, so it is not idle yet.
const COUNTS_AS_IDLE: ReadonlySet<OrchestrationV2RunStatus> = new Set([
  "starting",
  "running",
  "waiting",
]);
const TERMINAL: ReadonlySet<OrchestrationV2RunStatus> = new Set([
  "completed",
  "interrupted",
  "failed",
  "cancelled",
  "rolled_back",
]);

export const pollIntervalMs = (idleLimitMs: number): number =>
  Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, Math.floor(idleLimitMs / 10)));

/**
 * Watches one run until it ends or sits idle past `idleLimitMs`, then asks for
 * an interrupt. A run that keeps producing activity is never cut, however long
 * it takes. A limit of 0 (or less) turns the watch off. A read that fails is
 * retried on the next poll, so a short outage cannot kill a healthy run.
 */
export const watchRunForIdle = <E1, E2>(input: {
  readonly idleLimitMs: number;
  readonly readRun: Effect.Effect<Option.Option<RunActivity>, E1>;
  readonly interrupt: Effect.Effect<void, E2>;
  readonly nowMs: Effect.Effect<number>;
}): Effect.Effect<RunWatchdogOutcome, E2> =>
  Effect.gen(function* () {
    if (input.idleLimitMs <= 0) return "ended" as const;
    const poll = pollIntervalMs(input.idleLimitMs);
    while (true) {
      yield* Effect.sleep(poll);
      const run = yield* input.readRun.pipe(Effect.catch(() => Effect.succeed(undefined)));
      if (run === undefined) continue;
      if (Option.isNone(run) || TERMINAL.has(run.value.status)) return "ended" as const;
      if (!COUNTS_AS_IDLE.has(run.value.status)) continue;
      const now = yield* input.nowMs;
      if (now - run.value.lastActivityMs >= input.idleLimitMs) {
        yield* input.interrupt;
        return "interrupted" as const;
      }
    }
  });
