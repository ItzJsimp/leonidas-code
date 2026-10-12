import { CommandId, MessageId, type RunId, type ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as ThreadManagementService from "./ThreadManagementService.ts";

/**
 * Reruns a delegated task's brief once on its fallback model, in the same child
 * thread. The orchestrator held the failed result for this; the new run's
 * terminal publishes the task. When the rerun cannot start, the held failure
 * is published instead.
 */
export const rerunDelegatedTaskOnFallback = Effect.fn(
  "DelegatedTaskFallback.rerunDelegatedTaskOnFallback",
)(
  function* (input: { readonly threadId: ThreadId; readonly sourceRunId: RunId }) {
    const threads = yield* ThreadManagementService.ThreadManagementService;
    const messageId = MessageId.make(`message:delegated-fallback:${input.sourceRunId}`);
    const projection = yield* threads.getThreadRecords(
      input.threadId,
      ["messages", "runs", "subagents"],
      { messageRoles: ["user"] },
    );
    if (projection.thread.archivedAt !== null || projection.thread.deletedAt !== null) return;
    if (projection.messages.some((message) => message.id === messageId)) return;
    const source = projection.runs.find((run) => run.id === input.sourceRunId);
    if (source?.status !== "failed") return;
    // Anything the user or agent sent since takes precedence over a retry.
    if (projection.runs.some((run) => run.ordinal > source.ordinal)) return;
    const brief = projection.messages.find((message) => message.id === source.userMessageId);
    const parentThreadId = projection.thread.lineage.parentThreadId;
    const taskId =
      projection.thread.forkedFrom?.type === "node" ? projection.thread.forkedFrom.nodeId : null;
    if (brief === undefined || parentThreadId === null || taskId === null) return;
    const parent = yield* threads.getThreadRecords(parentThreadId, ["subagents"]);
    const fallback = parent.subagents.find((task) => task.id === taskId)?.fallbackModelSelection;
    if (fallback === undefined) return;
    yield* threads.dispatch({
      type: "message.dispatch",
      commandId: CommandId.make(`command:delegated-fallback-run:${input.sourceRunId}`),
      threadId: input.threadId,
      messageId,
      text: brief.text,
      notification: {
        source: { kind: "system" },
        outcome: "updated",
        summary: `${source.modelSelection.model} failed; retrying on ${fallback.model}`,
        detail: brief.text,
      },
      attachments: [],
      modelSelection: fallback,
      dispatchMode: { type: "start_immediately" },
      createdBy: "agent",
      creationSource: "server",
    });
  },
  // Once the rerun exists this is a no-op; that run settles the task.
  (effect, input) =>
    effect.pipe(
      Effect.andThen(
        Effect.gen(function* () {
          const threads = yield* ThreadManagementService.ThreadManagementService;
          yield* threads.recoverDelegatedTask(input.threadId, input.sourceRunId);
        }),
      ),
    ),
);
