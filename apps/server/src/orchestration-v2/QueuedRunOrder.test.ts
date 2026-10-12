import { describe, expect, it } from "vite-plus/test";
import {
  MessageId,
  NodeId,
  ProviderInstanceId,
  RunId,
  ThreadId,
  type OrchestrationV2ConversationMessage,
  type OrchestrationV2Run,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { isAutomaticCompletionRun, queuedRunsInDeliveryOrder } from "./QueuedRunOrder.ts";
const now = DateTime.makeUnsafe("2026-10-11T00:00:00Z");
const threadId = ThreadId.make("thread");
function message(
  id: string,
  automatic: "completion" | "notification" | null = null,
): OrchestrationV2ConversationMessage {
  return {
    createdBy: automatic ? "system" : "user",
    creationSource: "server",
    id: MessageId.make(id),
    threadId,
    runId: null,
    nodeId: null,
    role: "user",
    text: "Queued message",
    attachments: [],
    streaming: false,
    createdAt: now,
    updatedAt: now,
    ...(automatic === "completion"
      ? {
          delegatedCompletion: {
            generation: 1,
            parentRunId: RunId.make("parent"),
            taskIds: [NodeId.make("child")],
          },
        }
      : {}),
    ...(automatic === "notification"
      ? {
          notification: {
            source: { kind: "monitor" as const },
            outcome: "completed" as const,
            summary: "Checks passed",
          },
        }
      : {}),
  };
}
function run(
  id: string,
  messageId: string,
  ordinal: number,
  queuePosition: number,
): OrchestrationV2Run {
  const instanceId = ProviderInstanceId.make("codex");
  return {
    id: RunId.make(id),
    threadId,
    ordinal,
    queuePosition,
    userMessageId: MessageId.make(messageId),
    providerInstanceId: instanceId,
    modelSelection: { instanceId, model: "test" },
    providerThreadId: null,
    rootNodeId: null,
    activeAttemptId: null,
    status: "queued",
    requestedAt: now,
    startedAt: null,
    completedAt: null,
    checkpointId: null,
    contextHandoffId: null,
  };
}
describe("queued run delivery order", () => {
  it.each(["completion", "notification"] as const)(
    "keeps automatic %s delivery ahead of visible queued messages",
    (automatic) => {
      const projection = {
        messages: [
          message("visible-first"),
          message("automatic", automatic),
          message("visible-second"),
        ],
        runs: [
          run("visible-first", "visible-first", 2, 1),
          run("automatic", "automatic", 4, 3),
          run("visible-second", "visible-second", 3, 2),
        ],
      };
      expect(queuedRunsInDeliveryOrder(projection).map((entry) => entry.id)).toEqual([
        "automatic",
        "visible-first",
        "visible-second",
      ]);
      expect(isAutomaticCompletionRun(projection, projection.runs[1]!)).toBe(true);
      expect(isAutomaticCompletionRun(projection, projection.runs[0]!)).toBe(false);
    },
  );
});
