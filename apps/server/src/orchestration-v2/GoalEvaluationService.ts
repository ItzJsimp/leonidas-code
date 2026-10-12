// @effect-diagnostics nodeBuiltinImport:off - the approved goal check is a user-supplied shell command line.
import { latestRootProviderFailure } from "@t3tools/shared/orchestrationV2ThreadError";
import * as NodeChildProcess from "node:child_process";
import { CommandId, type RunId, type ThreadId, type ThreadGoalVerdict } from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import * as KeyedLock from "@t3tools/shared/KeyedLock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as ServerSettings from "../serverSettings.ts";
import * as TextGeneration from "../textGeneration/TextGeneration.ts";
import * as ProjectStore from "./ProjectStore.ts";
import * as ThreadManagement from "./ThreadManagementService.ts";

export class GoalEvaluationError extends Schema.TaggedError<GoalEvaluationError>()(
  "GoalEvaluationError",
  {
    threadId: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class GoalCheckRunner extends Context.Service<
  GoalCheckRunner,
  {
    readonly run: (command: string, cwd: string) => Effect.Effect<boolean>;
  }
>()("t3/orchestration-v2/GoalEvaluationService/GoalCheckRunner") {}

/** Runs only the exact command explicitly approved for this goal, in its bound workspace. */
export const layerCheckRunner = Layer.succeed(GoalCheckRunner, {
  run: (command, cwd) =>
    Effect.callback<boolean>((resume) => {
      const child = NodeChildProcess.exec(
        command,
        { cwd, windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 },
        (error) => resume(Effect.succeed(error === null)),
      );
      return Effect.sync(() => {
        child.kill();
      });
    }),
});

export class GoalEvaluationService extends Context.Service<
  GoalEvaluationService,
  {
    readonly execute: (input: {
      threadId: ThreadId;
      goalId: CommandId;
      runId: RunId;
      requestId?: CommandId;
    }) => Effect.Effect<void, GoalEvaluationError>;
  }
>()("t3/orchestration-v2/GoalEvaluationService") {}

const make = Effect.gen(function* () {
  const threads = yield* ThreadManagement.ThreadManagementService;
  const settings = yield* ServerSettings.ServerSettingsService;
  const projects = yield* ProjectStore.ProjectStoreV2;
  const generation = yield* TextGeneration.TextGeneration;
  const check = yield* GoalCheckRunner;
  const locks = yield* KeyedLock.make<ThreadId>();
  const execute: GoalEvaluationService["Service"]["execute"] = (input) =>
    locks.withLock(
      input.threadId,
      Effect.gen(function* () {
        const records = yield* threads.getThreadRecords(input.threadId, [
          "runs",
          "messages",
          "turnItems",
          "providerTurns",
        ]);
        const goal = records.thread.appGoal;
        if (!goal || goal.id !== input.goalId || !["active", "evaluating"].includes(goal.status))
          return;
        const complete = (result: {
          result?: ThreadGoalVerdict;
          pauseReason?: string;
          tokensUsed?: number;
          madeProgress?: boolean;
          retryableFailure?: boolean;
        }) =>
          threads
            .dispatch({
              type: "thread.goal.advance",
              commandId: CommandId.make(`${goal.id}:${input.runId}:goal-result`),
              ...input,
              ...result,
            })
            .pipe(Effect.asVoid);
        // A crashed evaluator may have spent tokens already. Pause instead of replaying that spend.
        if (goal.status === "evaluating") {
          if (goal.evaluationRunId === input.runId)
            yield* complete({
              pauseReason: "Evaluation was interrupted by a server restart. Resume explicitly.",
            });
          return;
        }
        // Stale or duplicate wakes (older run, pending work, lost race) produce no events and are rejected.
        // That is not a failure: skip the claim when the run is already counted, and re-read state after a rejection.
        const runOrdinal = records.runs.find((candidate) => candidate.id === input.runId)?.ordinal;
        if (runOrdinal === undefined || runOrdinal <= goal.lastRunOrdinal) return;
        yield* threads
          .dispatch({
            type: "thread.goal.advance",
            commandId: CommandId.make(
              `${input.requestId ?? `${goal.id}:${input.runId}`}:goal-claim`,
            ),
            ...input,
          })
          .pipe(Effect.ignore);
        const claimed = (yield* threads.getThreadRecords(input.threadId, [])).thread.appGoal;
        if (claimed?.status !== "evaluating" || claimed.evaluationRunId !== input.runId) return;
        const run = records.runs.find((candidate) => candidate.id === input.runId);
        const madeProgress = records.turnItems.some(
          (item) =>
            item.runId === input.runId &&
            item.status === "completed" &&
            ["command_execution", "dynamic_tool", "file_change"].includes(item.type),
        );
        const usage = records.providerTurns
          .filter((turn) => turn.runAttemptId === run?.activeAttemptId)
          .map((turn) => turn.turnTokenUsage);
        const tokensUsed = usage.reduce(
          (sum, value) => sum + (value?.inputTokens ?? 0) + (value?.outputTokens ?? 0),
          0,
        );
        if (run?.status === "failed") {
          const failure = latestRootProviderFailure(run, records.turnItems);
          if (
            failure?.retryable === true &&
            (failure.class === "transport_error" || failure.class === "provider_error") &&
            !/auth|login|credential|quota|credit|limit/i.test(failure.message)
          ) {
            yield* complete({
              result: {
                verdict: "unmet",
                reason: "Transient provider failure; retry remaining executable work.",
                evidence: "",
              },
              tokensUsed,
              madeProgress,
              retryableFailure: true,
            });
            return;
          }
        }
        if (run?.status !== "completed") {
          yield* complete({
            pauseReason:
              run?.status === "failed"
                ? "Provider failed. Resolve authentication, quota or connection, then resume."
                : "Turn stopped. Resume explicitly.",
            tokensUsed,
            madeProgress,
          });
          return;
        }
        if (
          goal.tokenBudget !== undefined &&
          (usage.length === 0 ||
            usage.some(
              (value) =>
                !value || value.inputTokens === undefined || value.outputTokens === undefined,
            ))
        ) {
          yield* complete({
            pauseReason: "Token usage is unavailable; the budget cannot be enforced.",
            madeProgress,
          });
          return;
        }
        if (goal.tokenBudget !== undefined && goal.tokensUsed + tokensUsed >= goal.tokenBudget) {
          yield* complete({ pauseReason: "Token budget reached.", tokensUsed, madeProgress });
          return;
        }
        const project = yield* projects.get(records.thread.projectId);
        if (Option.isNone(project)) {
          yield* complete({ pauseReason: "Workspace is unavailable.", tokensUsed, madeProgress });
          return;
        }
        const cwd = records.thread.worktreePath ?? project.value.workspaceRoot;
        if (goal.check) {
          if (!goal.checkCwd || cwd !== goal.checkCwd) {
            yield* complete({
              pauseReason: "Workspace changed. Approve the check again in a new goal.",
              tokensUsed,
              madeProgress,
            });
            return;
          }
          const passed = yield* check.run(goal.check.command, cwd);
          yield* complete({
            result: {
              verdict: passed ? "met" : "unmet",
              reason: passed
                ? "Approved check exited successfully."
                : "Approved check failed or timed out.",
              evidence: passed ? "Check exit code: 0" : "Check exit code: nonzero",
            },
            tokensUsed,
            madeProgress,
          });
          return;
        }
        const transcript = records.messages
          .filter((message) => !message.streaming)
          .slice(-20)
          .map((message) => `${message.role}: ${message.text}`)
          .join("\n")
          .slice(-24000);
        const selected = resolveProjectSettings(
          yield* settings.getSettings,
          records.thread.projectId,
        ).settings.textGenerationModelSelection;
        const evaluate = generation.evaluateGoal;
        if (!evaluate) {
          yield* complete({
            pauseReason: "Configured provider does not support goal evaluation.",
            tokensUsed,
            madeProgress,
          });
          return;
        }
        const outcome = yield* evaluate({
          cwd,
          condition: goal.condition,
          transcript,
          modelSelection: selected,
        }).pipe(
          Effect.timeout("60 seconds"),
          Effect.retry({
            times: 2,
            schedule: Schedule.exponential("1 second"),
            while: (error) =>
              !/auth|login|credential|quota|credit|limit|unsupported|does not support/i.test(
                String(error),
              ),
          }),
          Effect.result,
        );
        if (outcome._tag === "Failure") {
          yield* complete({
            pauseReason:
              "Evaluator failed or timed out. Check the configured provider, then resume.",
            tokensUsed,
            madeProgress,
          });
          return;
        }
        let result = outcome.success;
        if (
          result.verdict === "met" &&
          (!result.evidence.trim() || !transcript.includes(result.evidence))
        )
          result = {
            ...result,
            verdict: "unmet",
            reason: "Evaluator supplied no verifiable quoted completion evidence.",
          };
        yield* complete({ result, tokensUsed, madeProgress });
      }).pipe(
        Effect.mapError((cause) => new GoalEvaluationError({ threadId: input.threadId, cause })),
      ),
    );
  return GoalEvaluationService.of({ execute });
});
export const layer = Layer.effect(GoalEvaluationService, make);
