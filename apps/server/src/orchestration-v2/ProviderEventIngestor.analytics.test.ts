import { assert, it } from "@effect/vitest";
import { MessageId, NodeId, RunId, RunAttemptId, TurnItemId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as IdAllocator from "@t3tools/provider-core/server/IdAllocator";
import * as EventSink from "./EventSink.ts";
import * as ProviderEventIngestor from "./ProviderEventIngestor.ts";
import {
  layerTest,
  modelSelection,
  CODEX_DRIVER,
  threadCreatedEvent,
} from "./ProviderEventIngestor.test-fixtures.ts";

it.effect("records accepted billed turn usage once without billing the context window", () => {
  const recorded: Array<Readonly<Record<string, unknown>>> = [];
  const complianceLogs: unknown[] = [];
  const logCapture = Logger.make(({ message }) => {
    if (Array.isArray(message) && message[0] === "agent.output.compliance")
      complianceLogs.push(message[1]);
  });
  const layerAnalytics = Layer.succeed(ProviderEventIngestor.ProviderTurnAnalytics, {
    record: (properties: Readonly<Record<string, unknown>>) =>
      Effect.sync(() => {
        recorded.push(properties);
      }),
  });
  return Effect.gen(function* () {
    const now = yield* DateTime.now;
    const eventSink = yield* EventSink.EventSinkV2;
    const ingestor = yield* ProviderEventIngestor.ProviderEventIngestorV2;
    const idAllocator = yield* IdAllocator.IdAllocatorV2;
    const threadEvent = yield* threadCreatedEvent(now);
    yield* eventSink.write({ events: [threadEvent] });
    const providerSessionId = yield* idAllocator.allocate.providerSession({
      providerInstanceId: modelSelection.instanceId,
      threadId: threadEvent.threadId,
    });
    const providerThreadId = idAllocator.derive.providerThread({
      driver: CODEX_DRIVER,
      nativeThreadId: "billing-thread",
    });
    const providerTurn = {
      id: idAllocator.derive.providerTurn({ driver: CODEX_DRIVER, nativeTurnId: "billing-turn" }),
      providerThreadId,
      nodeId: NodeId.make("node:billing-turn"),
      runAttemptId: null,
      nativeTurnRef: null,
      ordinal: 1,
      status: "completed" as const,
      startedAt: now,
      completedAt: DateTime.makeUnsafe(DateTime.toEpochMillis(now) + 120),
      tokenUsage: {
        inputTokens: 4000,
        cachedInputTokens: 3000,
        outputTokens: 100,
        usedTokens: 4100,
        updatedAt: DateTime.formatIso(now),
      },
      turnTokenUsage: {
        usageStatus: "complete" as const,
        usageScope: "main_agent" as const,
        hasSubagents: false,
        inputTokens: 40,
        cachedInputTokens: 30,
        outputTokens: 10,
      },
    };
    const input = {
      providerSessionId,
      providerInstanceId: modelSelection.instanceId,
      threadId: threadEvent.threadId,
      runId: RunId.make("run:compliance"),
      analyticsContext: {
        modelSelection,
        runtimeMode: "full-access" as const,
        interactionMode: "default" as const,
      },
      event: { type: "provider_turn.updated" as const, driver: CODEX_DRIVER, providerTurn },
    };
    yield* ingestor.ingestNormalized({
      ...input,
      event: {
        type: "turn_item.updated",
        driver: CODEX_DRIVER,
        turnItem: {
          id: TurnItemId.make("item:compliance"),
          threadId: threadEvent.threadId,
          runId: input.runId,
          nodeId: null,
          providerThreadId,
          providerTurnId: providerTurn.id,
          nativeItemRef: null,
          parentItemId: null,
          ordinal: 1,
          status: "completed",
          title: null,
          startedAt: now,
          completedAt: now,
          updatedAt: now,
          type: "assistant_message",
          messageId: MessageId.make("message:compliance"),
          text: "private-reply ".repeat(401),
          streaming: false,
        },
      },
    });
    yield* ingestor.ingestNormalized(input);
    yield* ingestor.ingestNormalized(input);
    const ignored = yield* ingestor.ingestNormalized({
      ...input,
      event: {
        ...input.event,
        providerTurn: {
          ...providerTurn,
          id: idAllocator.derive.providerTurn({
            driver: CODEX_DRIVER,
            nativeTurnId: "stale-billing-turn",
          }),
        },
      },
      writeIfRunCurrent: {
        runId: RunId.make("missing-run"),
        activeAttemptId: RunAttemptId.make("stale-attempt"),
        expectedStatus: "running",
      },
    });
    assert.isEmpty(ignored);
    assert.lengthOf(recorded, 1);
    assert.lengthOf(complianceLogs, 1);
    assert.deepEqual(complianceLogs[0], {
      provider: CODEX_DRIVER,
      model: modelSelection.model,
      version: 1,
      eligible: true,
      top: false,
      dock: false,
      wordCount: 401,
      canvasRequired: true,
      canvasPresent: false,
      canvas: false,
    });
    assert.notInclude(JSON.stringify(complianceLogs), "private-reply");
    assert.deepEqual(recorded[0], {
      provider: CODEX_DRIVER,
      terminalStatus: "completed",
      usageStatus: "complete",
      usageScope: "main_agent",
      hasSubagents: false,
      inputTokens: 40,
      cachedInputTokens: 30,
      outputTokens: 10,
      model: modelSelection.model,
      mixedModels: false,
      runtimeMode: "full-access",
      interactionMode: "default",
      durationMs: 120,
    });
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        layerTest.pipe(Layer.provide(layerAnalytics)),
        Logger.layer([logCapture], { mergeWithExisting: false }),
      ),
    ),
  );
});
