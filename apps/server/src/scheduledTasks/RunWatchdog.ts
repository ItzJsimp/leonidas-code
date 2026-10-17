import type {
  OrchestrationV2ProviderTurn,
  OrchestrationV2RunAttempt,
  OrchestrationV2RunStatus,
  RunId,
} from "@t3tools/contracts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

export const DEFAULT_IDLE_LIMIT_MS = 600_000;

/**
 * How long a scheduled run may sit without activity before it is interrupted.
 * Set T3CODE_SCHEDULED_TASK_IDLE_LIMIT_SECONDS; 0 turns the idle check off.
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
  /** Tokens the run has used so far. Missing counts as 0. */
  readonly tokensUsed?: number;
}

export type RunWatchdogOutcome = "ended" | "idle" | "token_cap";

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
  idleLimitMs > 0
    ? Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, Math.floor(idleLimitMs / 10)))
    : MAX_POLL_MS;

/**
 * Tokens one run has used: for each provider turn of its attempts, the final
 * input plus output when the provider reported it, else the live used-token
 * count. The live count is context size, so it can differ from what was billed.
 */
export const runTokensUsed = (
  projection: {
    readonly attempts: ReadonlyArray<Pick<OrchestrationV2RunAttempt, "id" | "runId">>;
    readonly providerTurns: ReadonlyArray<
      Pick<OrchestrationV2ProviderTurn, "runAttemptId" | "tokenUsage" | "turnTokenUsage">
    >;
  },
  runId: RunId,
): number => {
  const attemptIds = new Set(
    projection.attempts.filter((attempt) => attempt.runId === runId).map((attempt) => attempt.id),
  );
  let total = 0;
  for (const turn of projection.providerTurns) {
    if (turn.runAttemptId === null || !attemptIds.has(turn.runAttemptId)) continue;
    total += turn.turnTokenUsage
      ? (turn.turnTokenUsage.inputTokens ?? 0) + (turn.turnTokenUsage.outputTokens ?? 0)
      : (turn.tokenUsage?.usedTokens ?? 0);
  }
  return total;
};

/**
 * Watches one run until it ends, sits idle past `idleLimitMs`, or uses
 * `tokenCap` tokens, then asks for an interrupt. A run that keeps producing
 * activity is never cut for idling, however long it takes. An idle limit of 0
 * (or less) turns the idle check off; a missing cap turns the cap off; with
 * both off the watch ends at once. A read that fails is retried on the next
 * poll, so a short outage cannot kill a healthy run.
 */
export const watchRun = <E1, E2>(input: {
  readonly idleLimitMs: number;
  readonly tokenCap?: number | null | undefined;
  readonly readRun: Effect.Effect<Option.Option<RunActivity>, E1>;
  readonly interrupt: Effect.Effect<void, E2>;
  readonly nowMs: Effect.Effect<number>;
}): Effect.Effect<RunWatchdogOutcome, E2> =>
  Effect.gen(function* () {
    const cap = input.tokenCap ?? null;
    if (input.idleLimitMs <= 0 && cap === null) return "ended" as const;
    const poll = pollIntervalMs(input.idleLimitMs);
    while (true) {
      yield* Effect.sleep(poll);
      const run = yield* input.readRun.pipe(Effect.catch(() => Effect.succeed(undefined)));
      if (run === undefined) continue;
      if (Option.isNone(run) || TERMINAL.has(run.value.status)) return "ended" as const;
      if (cap !== null && (run.value.tokensUsed ?? 0) >= cap) {
        yield* input.interrupt;
        return "token_cap" as const;
      }
      if (input.idleLimitMs <= 0 || !COUNTS_AS_IDLE.has(run.value.status)) continue;
      const now = yield* input.nowMs;
      if (now - run.value.lastActivityMs >= input.idleLimitMs) {
        yield* input.interrupt;
        return "idle" as const;
      }
    }
  });
