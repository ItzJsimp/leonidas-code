import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import * as ProcessRunner from "../processRunner.ts";
import * as TaskBoardService from "./TaskBoardService.ts";

const issue = {
  number: 12,
  title: "Build the board",
  url: "https://github.com/ItzJsimp/leonidas-code/issues/12",
  updatedAt: "2026-10-10T12:00:00Z",
  labels: [{ name: "feature" }],
  assignees: [{ login: "vMobxAi" }],
};

const output = (stdout: string, code = 0, stderr = ""): ProcessRunner.ProcessRunOutput => ({
  stdout,
  stderr,
  code: code as ProcessRunner.ProcessRunOutput["code"],
  timedOut: false,
  stdoutTruncated: false,
  stderrTruncated: false,
  stdoutInvalidUtf8: false,
  stderrInvalidUtf8: false,
});

it.effect.each([
  [
    "reports disabled Issues explicitly",
    output("", 1, "the repository has disabled issues"),
    "issues_disabled",
  ],
  [
    "reports GitHub failures without exposing stderr",
    output("", 1, "sensitive provider response"),
    "request_failed",
  ],
  ["rejects malformed GitHub JSON", output("not json"), "invalid_response"],
  ["rejects malformed issue records", output(JSON.stringify([{ number: -1 }])), "invalid_response"],
] as const)("%s", ([_name, response, reason]) =>
  Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    const result = yield* Effect.result(board.list);
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.failure.reason).toBe(reason);
      expect(result.failure.message).not.toContain("sensitive provider response");
    }
  }).pipe(
    Effect.provide(
      TaskBoardService.layer.pipe(
        Layer.provide(
          Layer.succeed(ProcessRunner.ProcessRunner, { run: () => Effect.succeed(response) }),
        ),
      ),
    ),
  ),
);

it.effect("loads the shared repository and refreshes cached issues after five seconds", () =>
  Effect.gen(function* () {
    let calls = 0;
    const runner = ProcessRunner.ProcessRunner.of({
      run: (input) =>
        Effect.sync(() => {
          expect(input.command).toBe("gh");
          expect(input.args).toContain("ItzJsimp/leonidas-code");
          calls++;
          return output(JSON.stringify(calls === 1 ? [issue] : []));
        }),
    });
    yield* Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      expect((yield* board.list).issues).toEqual([issue]);
      expect((yield* board.list).issues).toEqual([issue]);
      expect(calls).toBe(1);
      yield* TestClock.adjust("5 seconds");
      expect((yield* board.list).issues).toEqual([]);
      expect(calls).toBe(2);
    }).pipe(
      Effect.provide(
        TaskBoardService.layer.pipe(
          Layer.provide(Layer.succeed(ProcessRunner.ProcessRunner, runner)),
        ),
      ),
    );
  }),
);

it.effect("supports task creation, claims by agent, releases, and completion with audit history", () =>
  Effect.gen(function* () {
    const runner = ProcessRunner.ProcessRunner.of({
      run: () => Effect.succeed(output("[]")),
    });

    yield* Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;

      // 1. Create a task
      const created = yield* board.create({
        title: "Verify agent claim sync",
        description: "Test claiming across Jake and Mob environments",
        priority: "high",
      });
      expect(created.title).toBe("Verify agent claim sync");
      expect(created.status).toBe("todo");
      expect(created.claimedBy).toBeNull();
      expect(created.history.length).toBeGreaterThanOrEqual(1);
      expect(created.history[0]?.action).toBe("created");

      // 2. Claim task by Mob's agent
      const claimed = yield* board.claim({
        taskId: created.id,
        claimedBy: "Mob (claude)",
      });
      expect(claimed.status).toBe("in_progress");
      expect(claimed.claimedBy).toBe("Mob (claude)");
      expect(claimed.claimedAt).not.toBeNull();
      const claimEvent = claimed.history.find((h) => h.action === "claimed");
      expect(claimEvent?.actor).toBe("Mob (claude)");

      // 3. Release claim back to queue
      const released = yield* board.release({
        taskId: created.id,
      });
      expect(released.status).toBe("todo");
      expect(released.claimedBy).toBeNull();
      expect(released.claimedAt).toBeNull();

      // 4. Claim by Jake's agent and complete
      yield* board.claim({
        taskId: created.id,
        claimedBy: "Jake (gemini)",
      });
      const completed = yield* board.complete({
        taskId: created.id,
        completedBy: "Jake (gemini)",
        summary: "Verified synchronized claim database and UI",
      });
      expect(completed.status).toBe("done");
      expect(completed.completedBy).toBe("Jake (gemini)");
      expect(completed.completionSummary).toBe("Verified synchronized claim database and UI");
      const doneEvent = completed.history.find((h) => h.action === "completed");
      expect(doneEvent?.actor).toBe("Jake (gemini)");
    }).pipe(
      Effect.provide(
        TaskBoardService.layer.pipe(
          Layer.provide(Layer.succeed(ProcessRunner.ProcessRunner, runner)),
        ),
      ),
    );
  }),
);
