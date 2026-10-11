import {
  TASK_BOARD_REPOSITORY,
  TaskBoardIssue,
  TaskBoardReadError,
  type TaskBoardSnapshot,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as ProcessRunner from "../processRunner.ts";

const LIMIT = 200;
const decodeIssues = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(TaskBoardIssue)),
);

export class TaskBoardService extends Context.Service<
  TaskBoardService,
  {
    readonly list: Effect.Effect<typeof TaskBoardSnapshot.Type, TaskBoardReadError>;
  }
>()("t3/taskBoard/TaskBoardService") {}

const make = Effect.gen(function* () {
  const processes = yield* ProcessRunner.ProcessRunner;
  const read = Effect.gen(function* () {
    const result = yield* processes
      .run({
        command: "gh",
        args: [
          "issue",
          "list",
          "--repo",
          TASK_BOARD_REPOSITORY,
          "--state",
          "open",
          "--limit",
          String(LIMIT),
          "--json",
          "number,title,url,updatedAt,labels,assignees",
        ],
        timeout: "15 seconds",
        maxOutputBytes: 2 * 1024 * 1024,
      })
      .pipe(
        Effect.mapError(
          (cause) =>
            new TaskBoardReadError({
              reason: cause._tag === "ProcessSpawnError" ? "unavailable" : "request_failed",
              cause,
            }),
        ),
      );
    if (result.code !== 0 || result.timedOut) {
      return yield* Effect.fail(
        new TaskBoardReadError({
          reason: result.stderr.includes("disabled issues") ? "issues_disabled" : "request_failed",
          cause: result,
        }),
      );
    }
    const issues = yield* decodeIssues(result.stdout).pipe(
      Effect.mapError((cause) => new TaskBoardReadError({ reason: "invalid_response", cause })),
    );
    return {
      repository: TASK_BOARD_REPOSITORY,
      issues: issues.map((issue) => ({
        ...issue,
        url: `https://github.com/${TASK_BOARD_REPOSITORY}/issues/${issue.number}`,
      })),
      checkedAt: yield* Clock.currentTimeMillis,
      limit: LIMIT,
    } satisfies typeof TaskBoardSnapshot.Type;
  });
  // Share one read across clients, including failures, rather than spawning gh for each poll.
  const list = yield* Effect.cachedWithTTL(read, "5 seconds");
  return TaskBoardService.of({ list });
});

export const layer = Layer.effect(TaskBoardService, make);
