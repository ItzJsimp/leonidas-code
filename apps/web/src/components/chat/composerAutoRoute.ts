import type { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import type { AutoRouteCandidate, AutoRouteThreadState } from "@t3tools/shared/autoRouter";

import type { ContextWindowSnapshot } from "../../lib/contextWindow";

import type { AppModelOption } from "../../modelSelection";
import { isProviderInstancePickerReady, type ProviderInstanceEntry } from "../../providerInstances";

/**
 * Everything the composer picker would let the user pick right now: ready
 * instances, the thread's provider lock, and per-model disabled reasons.
 */
export function buildComposerAutoRouteCandidates(input: {
  readonly entries: ReadonlyArray<ProviderInstanceEntry>;
  readonly modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<AppModelOption>>;
  readonly lockedProvider: ProviderDriverKind | null;
  readonly lockedContinuationGroupKey: string | null;
  readonly getModelDisabledReason: (instanceId: ProviderInstanceId, model: string) => string | null;
}): AutoRouteCandidate[] {
  return input.entries.flatMap((entry) => {
    if (!isProviderInstancePickerReady(entry)) return [];
    if (input.lockedProvider !== null) {
      if (entry.driverKind !== input.lockedProvider) return [];
      if (
        input.lockedContinuationGroupKey &&
        entry.continuationGroupKey !== input.lockedContinuationGroupKey
      )
        return [];
    }
    const models = (input.modelOptionsByInstance.get(entry.instanceId) ?? []).flatMap((option) => {
      if (option.isUnavailable || input.getModelDisabledReason(entry.instanceId, option.slug))
        return [];
      const model = entry.models.find((candidate) => candidate.slug === option.slug);
      return [
        {
          slug: option.slug,
          name: option.name,
          capabilities: model?.capabilities,
          isLegacy: option.isLegacy,
          inputCostPerMillionTokens: model?.inputCostPerMillionTokens,
          outputCostPerMillionTokens: model?.outputCostPerMillionTokens,
        },
      ];
    });
    if (models.length === 0) return [];
    return [
      {
        instanceId: entry.instanceId,
        driverKind: entry.driverKind,
        label: entry.displayName,
        continuationGroupKey: entry.continuationGroupKey,
        usageLimits: entry.snapshot.usageLimits,
        models,
      },
    ];
  });
}

/** The context the thread's provider last reported, which decides what a move would cost. */
export function composerAutoRouteThreadState(input: {
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly currentInstanceId: ProviderInstanceId | undefined;
  readonly entries: ReadonlyArray<ProviderInstanceEntry>;
}): AutoRouteThreadState | undefined {
  const entry = input.entries.find((candidate) => candidate.instanceId === input.currentInstanceId);
  if (!input.contextWindow || !entry) return undefined;
  const lastActivityAt = Date.parse(input.contextWindow.updatedAt);
  return {
    contextTokens: input.contextWindow.usedTokens,
    driverKind: entry.driverKind,
    lastActivityAt: Number.isFinite(lastActivityAt) ? lastActivityAt : null,
  };
}
