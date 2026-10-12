import { assert, it } from "@effect/vitest";
import {
  CommandId,
  ProjectId,
  ProviderInstanceId,
  SavedItemId,
  ScheduledTaskId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as ThreadLaunch from "../orchestration-v2/ThreadLaunchService.ts";
import * as Projects from "../project/ProjectService.ts";
import * as ScheduledTasks from "../scheduledTasks/ScheduledTaskService.ts";
import * as TaskBoard from "../taskBoard/TaskBoardService.ts";
import * as SavedItems from "./SavedItemService.ts";
import * as Execution from "./SavedItemExecution.ts";

const create = (id: string) => ({
  commandId: CommandId.make(`create:${id}`),
  id: SavedItemId.make(id),
  kind: "prompt" as const,
  title: "Saved",
  body: "Do work",
  tags: [],
  projectId: ProjectId.make("project"),
});
const input = (id: string, command = `launch:${id}`) => ({
  commandId: CommandId.make(command),
  id: SavedItemId.make(id),
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-6.1-sol" },
  runtimeMode: "approval-required" as const,
  interactionMode: "default" as const,
  workspaceStrategy: { type: "root" as const },
});
const setup = (options: { fail?: boolean } = {}) => {
  const calls: ThreadLaunch.ThreadLaunchInput[] = [];
  const scheduled: unknown[] = [];
  const tasks: unknown[] = [];
  let fail = options.fail ?? false;
  const dependencies = Layer.mergeAll(
    Layer.mock(ThreadLaunch.ThreadLaunchService)({
      launch: (request) =>
        Effect.gen(function* () {
          calls.push(request);
          if (fail)
            return yield* new ThreadLaunch.ThreadLaunchError({
              operation: "create-thread",
              commandId: request.commandId,
              projectId: request.projectId,
              cause: "unavailable",
            });
          return { threadId: request.threadId!, resumed: false, projection: undefined! };
        }),
    }),
    Layer.mock(ScheduledTasks.ScheduledTaskService)({
      upsert: (request) =>
        Effect.sync(() => {
          scheduled.push(request);
          return { task: { id: request.id ?? ScheduledTaskId.make("schedule") } as never };
        }),
    }),
    Layer.mock(Projects.ProjectService)({
      snapshot: Effect.succeed({ projects: [], updatedAt: "2026-10-12T00:00:00Z" }),
    }),
    Layer.mock(TaskBoard.TaskBoardService)({
      cardCreate: (request) =>
        Effect.sync(() => {
          tasks.push(request);
          return { id: "board-task" } as never;
        }),
    }),
  );
  const store = SavedItems.layer.pipe(Layer.provideMerge(Sqlite.layerMemory));
  const layer = Execution.layer.pipe(Layer.provide(dependencies), Layer.provideMerge(store));
  return {
    layer,
    calls,
    scheduled,
    tasks,
    recover: () => {
      fail = false;
    },
  };
};

it.effect("launches once, marks agent provenance and keeps the thread link through requeue", () => {
  const test = setup();
  return Effect.gen(function* () {
    const items = yield* SavedItems.SavedItemService;
    const execution = yield* Execution.SavedItemExecution;
    yield* items.create(create("one"));
    const launch = execution.launch(input("one")).pipe(
      Effect.provideService(SavedItems.SavedItemCaller, {
        actor: "agent",
        threadId: ThreadId.make("caller"),
      }),
    );
    const item = yield* launch;
    assert.equal(item.status, "launched");
    assert.equal(item.launchedBy, "agent");
    assert.equal(test.calls[0]?.initialMessage?.text, "Do work");
    assert.equal(test.calls[0]?.runtimeMode, "approval-required");
    assert.deepEqual(yield* launch, item);
    assert.equal(test.calls.length, 1);
    const requeued = yield* items.transition({
      commandId: CommandId.make("requeue"),
      id: item.id,
      action: "requeue",
    });
    assert.equal(requeued.status, "queued");
    assert.equal(requeued.launchedThreadId, item.launchedThreadId);
    yield* items.create(create("child"));
    const chained = yield* Effect.result(
      execution.launch(input("child")).pipe(
        Effect.provideService(SavedItems.SavedItemCaller, {
          actor: "agent",
          threadId: item.launchedThreadId,
        }),
      ),
    );
    assert.equal(chained._tag, "Failure");
    assert.equal(test.calls.length, 1);
  }).pipe(Effect.provide(test.layer));
});

it.effect(
  "drains a failed durable request after recovery, without a second intent or sleep",
  () => {
    const test = setup({ fail: true });
    return Effect.gen(function* () {
      const items = yield* SavedItems.SavedItemService;
      const execution = yield* Execution.SavedItemExecution;
      const sql = yield* SqlClient.SqlClient;
      yield* items.create(create("recover"));
      assert.equal((yield* Effect.result(execution.launch(input("recover"))))._tag, "Failure");
      assert.equal((yield* items.pending).length, 1);
      assert.equal(
        (yield* Effect.result(
          items.update({
            id: SavedItemId.make("recover"),
            commandId: CommandId.make("edit"),
            body: "other",
          }),
        ))._tag,
        "Failure",
      );
      test.recover();
      yield* execution.drain;
      assert.equal((yield* items.pending).length, 0);
      assert.equal((yield* items.get(SavedItemId.make("recover"))).status, "launched");
      assert.equal((yield* sql`SELECT * FROM saved_item_effects`).length, 1);
      assert.equal(test.calls[0]?.commandId, test.calls[1]?.commandId);
    }).pipe(Effect.provide(test.layer));
  },
);

it.effect("moves task saves off the list and schedules a linked one-time prompt", () => {
  const test = setup();
  return Effect.gen(function* () {
    const items = yield* SavedItems.SavedItemService;
    const execution = yield* Execution.SavedItemExecution;
    yield* items.create(create("task"));
    const task = yield* execution.saveTask({
      commandId: CommandId.make("task-save"),
      id: SavedItemId.make("task"),
    });
    assert.equal(task.boardTaskId, "board-task");
    assert.equal((yield* items.list({})).items.length, 0);
    assert.deepEqual(test.tasks[0], {
      title: "Saved",
      description: "Do work",
      actor: "user",
      idempotencyKey: "task-save",
      projectId: "project",
    });
    yield* items.create(create("timer"));
    const runAt = "2099-10-12T23:30:00.000Z";
    const scheduled = yield* execution.schedule({ ...input("timer", "schedule"), runAt });
    assert.equal(scheduled.scheduledTaskId, "saved-item:schedule");
    assert.deepInclude(test.scheduled[0], {
      prompt: "Do work",
      threadId: null,
      schedule: { type: "once", runAt },
    });
    assert.equal(test.calls.length, 0);
  }).pipe(Effect.provide(test.layer));
});

it.effect("caps concurrent agent launch and schedule requests at ten per hour", () => {
  const test = setup();
  return Effect.gen(function* () {
    const items = yield* SavedItems.SavedItemService;
    const execution = yield* Execution.SavedItemExecution;
    for (let index = 0; index < 11; index++) yield* items.create(create(String(index)));
    const results = yield* Effect.forEach(
      Array.from({ length: 11 }, (_, index) => index),
      (index) => Effect.result(execution.launch(input(String(index)))),
      { concurrency: "unbounded" },
    );
    assert.equal(results.filter((result) => result._tag === "Success").length, 10);
    assert.equal(test.calls.length, 10);
    yield* items.create(create("timer"));
    assert.equal(
      (yield* Effect.result(
        execution.schedule({ ...input("timer"), runAt: "2099-10-12T23:30:00Z" }),
      ))._tag,
      "Failure",
    );
  }).pipe(
    Effect.provideService(SavedItems.SavedItemCaller, { actor: "agent", threadId: null }),
    Effect.provide(test.layer),
  );
});

it.effect(
  "rejects blank launches, note launches, invalid dates and oversized task saves before committing effects",
  () => {
    const test = setup();
    return Effect.gen(function* () {
      const items = yield* SavedItems.SavedItemService;
      const execution = yield* Execution.SavedItemExecution;
      yield* items.create({ ...create("empty"), body: " " });
      yield* items.create({ ...create("note"), kind: "note" });
      yield* items.create(create("date"));
      yield* items.create({ ...create("large"), body: "x".repeat(20_001) });
      assert.equal((yield* Effect.result(execution.launch(input("empty"))))._tag, "Failure");
      assert.equal((yield* Effect.result(execution.launch(input("note"))))._tag, "Failure");
      assert.equal(
        (yield* Effect.result(
          execution.schedule({ ...input("date"), runAt: "2099-02-30T09:00:00Z" }),
        ))._tag,
        "Failure",
      );
      assert.equal(
        (yield* Effect.result(
          execution.saveTask({
            commandId: CommandId.make("large-task"),
            id: SavedItemId.make("large"),
          }),
        ))._tag,
        "Failure",
      );
      assert.equal((yield* items.pending).length, 0);
      assert.equal(test.calls.length, 0);
      assert.equal(test.tasks.length, 0);
    }).pipe(Effect.provide(test.layer));
  },
);
