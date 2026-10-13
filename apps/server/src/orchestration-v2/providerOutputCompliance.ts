import type {
  ModelSelection,
  RuntimeMode,
  ProviderInteractionMode,
  OrchestrationV2ProviderTurn,
  OrchestrationV2TurnItem,
  ProviderTurnId,
} from "@t3tools/contracts";
import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as DateTime from "effect/DateTime";
import { getModelSelectionStringOptionValue } from "@t3tools/shared/model";
import { measureOutputCompliance } from "@t3tools/shared/outputCompliance";
import { htmlRenderFromToolItem } from "@t3tools/shared/toolOutput";

export interface ProviderTurnAnalyticsContext {
  readonly modelSelection: ModelSelection;
  readonly runtimeMode?: RuntimeMode;
  readonly interactionMode?: ProviderInteractionMode;
}

export function providerTurnAnalyticsProperties(input: {
  readonly driver: ProviderAdapter.ProviderAdapterV2Event["driver"];
  readonly providerTurn: OrchestrationV2ProviderTurn;
  readonly context?: ProviderTurnAnalyticsContext;
}): Readonly<Record<string, unknown>> {
  const usage = input.providerTurn.turnTokenUsage;
  const modelSelection = input.context?.modelSelection;
  const effort = modelSelection
    ? (getModelSelectionStringOptionValue(modelSelection, "reasoningEffort") ??
      getModelSelectionStringOptionValue(modelSelection, "effort"))
    : undefined;
  return {
    provider: input.driver,
    terminalStatus: input.providerTurn.status,
    usageStatus: usage?.usageStatus ?? "unavailable",
    usageScope: usage?.usageScope ?? "main_agent",
    ...(usage ? { hasSubagents: usage.hasSubagents } : {}),
    ...(usage?.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }),
    ...(usage?.cachedInputTokens === undefined
      ? {}
      : { cachedInputTokens: usage.cachedInputTokens }),
    ...(usage?.cacheCreationTokens === undefined
      ? {}
      : { cacheCreationTokens: usage.cacheCreationTokens }),
    ...(usage?.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens }),
    ...(usage?.reasoningTokens === undefined ? {} : { reasoningTokens: usage.reasoningTokens }),
    ...(modelSelection ? { model: modelSelection.model, mixedModels: false } : {}),
    ...(effort ? { effort } : {}),
    ...(input.context?.runtimeMode ? { runtimeMode: input.context.runtimeMode } : {}),
    ...(input.context?.interactionMode ? { interactionMode: input.context.interactionMode } : {}),
    ...(input.providerTurn.startedAt && input.providerTurn.completedAt
      ? {
          durationMs: Math.max(
            0,
            DateTime.toEpochMillis(input.providerTurn.completedAt) -
              DateTime.toEpochMillis(input.providerTurn.startedAt),
          ),
        }
      : {}),
  };
}

export function providerOutputCompliance(
  items: ReadonlyArray<OrchestrationV2TurnItem>,
  providerTurnId: ProviderTurnId,
) {
  const scoped = items.filter((item) => item.providerTurnId === providerTurnId);
  const message = scoped.reduce<
    Extract<OrchestrationV2TurnItem, { type: "assistant_message" }> | undefined
  >(
    (last, item) =>
      item.type === "assistant_message" &&
      item.status === "completed" &&
      !item.streaming &&
      (!last || item.ordinal > last.ordinal)
        ? item
        : last,
    undefined,
  );
  if (!message) return undefined;
  const canvasPresent = scoped.some(
    (item) =>
      item.type === "dynamic_tool" &&
      item.status === "completed" &&
      htmlRenderFromToolItem(item) !== undefined,
  );
  return measureOutputCompliance(message.text, canvasPresent);
}
