import {
  CommandId,
  MessageId,
  SavedItemError,
  ScheduledTaskId,
  ThreadId,
  type SavedItem,
  type SavedItemLaunchInput,
  type SavedItemScheduleInput,
  type SavedItemTaskInput,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";
import * as Schema from "effect/Schema";
import * as DateTime from "effect/DateTime";
import * as ThreadLaunch from "../orchestration-v2/ThreadLaunchService.ts";
import * as Projects from "../project/ProjectService.ts";
import * as ScheduledTasks from "../scheduledTasks/ScheduledTaskService.ts";
import * as TaskBoard from "../taskBoard/TaskBoardService.ts";
import * as Scheduler from "../scheduling/Scheduler.ts";
import * as SavedItems from "./SavedItemService.ts";

export class SavedItemExecution extends Context.Service<
  SavedItemExecution,
  {
    readonly launch: (input: SavedItemLaunchInput) => Effect.Effect<SavedItem, SavedItemError>;
    readonly schedule: (input: SavedItemScheduleInput) => Effect.Effect<SavedItem, SavedItemError>;
    readonly saveTask: (input: SavedItemTaskInput) => Effect.Effect<SavedItem, SavedItemError>;
    /** Completes durable requests without sleeps; the scheduler calls the same path after restart. */
    readonly drain: Effect.Effect<void, SavedItemError>;
  }
>()("t3/savedItems/SavedItemExecution") {}
const isSavedItemError = Schema.is(SavedItemError);

const make = Effect.gen(function* () {
  const items = yield* SavedItems.SavedItemService;
  const launch = yield* ThreadLaunch.ThreadLaunchService;
  const schedules = yield* ScheduledTasks.ScheduledTaskService;
  const board = yield* TaskBoard.TaskBoardService;
  const projects = yield* Projects.ProjectService;
  const lock = yield* Semaphore.make(1);
  const execute = ({ request, item, actor }: SavedItems.PendingSavedItemEffect) =>
    Effect.gen(function* () {
      const { commandId } = request.input;
      const effectCommandId = CommandId.make(`saved-item:${commandId}`);
      if (request.action === "task") {
        const snapshot = yield* projects.snapshot;
        const task = yield* board.cardCreate(
          {
            title: item.title.trim() || "Saved prompt",
            description: item.body,
            actor,
            idempotencyKey: String(commandId),
            ...(item.workspaceId === undefined ? {} : { workspaceId: item.workspaceId }),
            ...(item.projectId === null ? { projectSlug: null } : { projectId: item.projectId }),
          },
          snapshot.projects,
        );
        return yield* items.complete(commandId, {
          launchedThreadId: item.launchedThreadId,
          boardTaskId: task.id,
        });
      }
      const projectId = request.input.projectId ?? item.projectId;
      if (projectId === null) return yield* new SavedItemError({ reason: "invalid_input" });
      const config = {
        commandId: effectCommandId,
        projectId,
        title: item.title.trim() || "Saved prompt",
        modelSelection: request.input.modelSelection,
        runtimeMode: request.input.runtimeMode,
        interactionMode: request.input.interactionMode,
        workspaceStrategy: request.input.workspaceStrategy,
        createdBy: actor,
        creationSource: actor === "agent" ? ("mcp" as const) : ("web" as const),
      };
      if (request.action === "schedule") {
        const { task } = yield* schedules.upsert({
          ...config,
          id: ScheduledTaskId.make(`saved-item:${commandId}`),
          prompt: item.body,
          enabled: true,
          schedule: {
            type: "once",
            runAt: DateTime.formatIso(DateTime.makeUnsafe(request.input.runAt)),
          },
          threadId: null,
        });
        return yield* items.complete(commandId, {
          launchedThreadId: item.launchedThreadId,
          scheduledTaskId: task.id,
        });
      }
      const result = yield* launch.launch({
        ...config,
        threadId: ThreadId.make(`saved-item:${commandId}`),
        initialMessage: {
          messageId: MessageId.make(`saved-item:${commandId}`),
          text: item.body,
          attachments: [],
        },
      });
      return yield* items.complete(commandId, { launchedThreadId: result.threadId });
    }).pipe(
      Effect.mapError((cause) =>
        isSavedItemError(cause) ? cause : new SavedItemError({ reason: "execution", cause }),
      ),
    );
  const perform = (request: SavedItems.SavedItemEffect) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const accepted = yield* items.request(request);
        if (!accepted.pendingCommandId) return accepted;
        const pending = yield* items.pending;
        const effect = pending.find(
          (candidate) => candidate.request.input.commandId === request.input.commandId,
        );
        return effect ? yield* execute(effect) : yield* items.get(request.input.id);
      }),
    );
  const drain = lock.withPermits(1)(
    Effect.gen(function* () {
      const pending = yield* items.pending;
      // One unavailable destination must not starve unrelated queued work.
      for (const effect of pending)
        yield* execute(effect).pipe(
          Effect.catch((error) =>
            Effect.logWarning("Saved-item effect failed", {
              commandId: effect.request.input.commandId,
              reason: error.reason,
            }),
          ),
        );
      yield* items.reconcileScheduledRuns;
    }),
  );
  return SavedItemExecution.of({
    launch: (input) => perform({ action: "launch", input }),
    schedule: (input) => perform({ action: "schedule", input }),
    saveTask: (input) => perform({ action: "task", input }),
    drain,
  });
});
export const layer = Layer.effect(SavedItemExecution, make);
export const layerWorker = Layer.effectDiscard(
  Effect.gen(function* () {
    const execution = yield* SavedItemExecution;
    const scheduler = yield* Scheduler.Scheduler;
    yield* scheduler.register("saved-item-effects", execution.drain);
  }),
);
