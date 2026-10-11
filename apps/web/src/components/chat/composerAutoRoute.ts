import type { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import type { AutoRouteCandidate } from "@t3tools/shared/autoRouter";

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
      const capabilities = entry.models.find((model) => model.slug === option.slug)?.capabilities;
      return [{ slug: option.slug, name: option.name, capabilities, isLegacy: option.isLegacy }];
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
