import { assert, describe, it } from "@effect/vitest";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { runMigrations } from "../persistence/Migrations.ts";
import * as ProcessRunner from "../processRunner.ts";
import { DelegatedTaskAcceptance, layer } from "./DelegatedTaskAcceptance.ts";

const at = "2026-10-14T12:00:00.000Z";

const fakeRunner = (code: number | null, stdout: string, calls: Array<string | undefined>) =>
  Layer.succeed(ProcessRunner.ProcessRunner, {
    run: (input) =>
      Effect.sync(() => {
        calls.push(input.cwd);
        return {
          stdout,
          stderr: "",
          code: code as never,
          timedOut: false,
          stdoutTruncated: false,
          stderrTruncated: false,
          stdoutInvalidUtf8: false,
          stderrInvalidUtf8: false,
        };
      }),
  });

const run = <A, E>(
  runner: Layer.Layer<ProcessRunner.ProcessRunner>,
  effect: Effect.Effect<A, E, DelegatedTaskAcceptance>,
) =>
  Effect.gen(function* () {
    yield* runMigrations();
    return yield* effect;
  }).pipe(
    Effect.provide(
      layer.pipe(
        Layer.provideMerge(runner),
        Layer.provideMerge(NodeSqliteClient.layer({ filename: ":memory:" })),
      ),
    ),
  );

describe("DelegatedTaskAcceptance", () => {
  it.effect("returns none for a task without a check", () =>
    run(
      fakeRunner(0, "", []),
      Effect.gen(function* () {
        const acceptance = yield* DelegatedTaskAcceptance;
        assert.isTrue(Option.isNone(yield* acceptance.evaluate("t1", "/work", at)));
      }),
    ),
  );

  it.effect("passes on exit 0, fails otherwise, and runs each check once", () => {
    const calls: Array<string | undefined> = [];
    return run(
      fakeRunner(0, "all good", calls),
      Effect.gen(function* () {
        const acceptance = yield* DelegatedTaskAcceptance;
        yield* acceptance.register("t1", "npm test");
        yield* acceptance.register("t1", "a different command");
        const first = yield* acceptance.evaluate("t1", "/work", at);
        const second = yield* acceptance.evaluate("t1", "/elsewhere", at);
        assert.deepStrictEqual(first, second);
        assert.deepStrictEqual(Option.getOrNull(first), {
          command: "npm test",
          verdict: "pass",
          exitCode: 0,
          outputTail: "all good",
        });
        assert.deepStrictEqual(calls, ["/work"]);
      }),
    );
  });

  it.effect("reports fail for a nonzero exit", () =>
    run(
      fakeRunner(2, "1 test failed", []),
      Effect.gen(function* () {
        const acceptance = yield* DelegatedTaskAcceptance;
        yield* acceptance.register("t1", "npm test");
        const result = Option.getOrNull(yield* acceptance.evaluate("t1", "/work", at));
        assert.deepStrictEqual([result?.verdict, result?.exitCode], ["fail", 2]);
      }),
    ),
  );

  it.effect("reports error when the task has no folder to run in", () => {
    const calls: Array<string | undefined> = [];
    return run(
      fakeRunner(0, "", calls),
      Effect.gen(function* () {
        const acceptance = yield* DelegatedTaskAcceptance;
        yield* acceptance.register("t1", "npm test");
        const result = Option.getOrNull(yield* acceptance.evaluate("t1", null, at));
        assert.strictEqual(result?.verdict, "error");
        assert.deepStrictEqual(calls, []);
      }),
    );
  });
});
