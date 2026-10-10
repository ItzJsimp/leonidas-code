import type { ModelSelection } from "@t3tools/contracts";
import type { UnifiedSettings } from "@t3tools/contracts/settings";
import { getAppModelOptionsForInstance } from "../../modelSelection";
import { isProviderInstancePickerReady, type ProviderInstanceEntry } from "../../providerInstances";

export interface ProviderFailoverTarget {
  readonly label: string;
  readonly modelSelection: ModelSelection;
}

export function getProviderFailoverTargets(input: {
  readonly entries: ReadonlyArray<ProviderInstanceEntry>;
  readonly settings: UnifiedSettings;
  readonly current: ModelSelection;
  readonly supportsHandoff: boolean;
}): ProviderFailoverTarget[] {
  if (!input.supportsHandoff) return [];
  const source = input.entries.find((entry) => entry.instanceId === input.current.instanceId);
  return input.entries
    .flatMap((entry) => {
      // The first slice stays on the user's Claude/Codex subscriptions. API-key
      // providers need an explicit cost choice rather than an incidental failover.
      if (
        entry.instanceId === input.current.instanceId ||
        (entry.driverKind !== "codex" && entry.driverKind !== "claudeAgent") ||
        !entry.installed ||
        !isProviderInstancePickerReady(entry) ||
        (source?.continuationGroupKey !== undefined &&
          source.continuationGroupKey === entry.continuationGroupKey) ||
        entry.snapshot.usageLimits?.windows.some((window) => window.usedPercent >= 100)
      )
        return [];
      const models = getAppModelOptionsForInstance(input.settings, entry).filter(
        (model) => !model.isUnavailable,
      );
      const model = models.find((candidate) => candidate.isDefault) ?? models[0];
      return model
        ? [
            {
              label: entry.displayName,
              modelSelection: { instanceId: entry.instanceId, model: model.slug },
            },
          ]
        : [];
    })
    .sort((left, right) => {
      const driverOf = (target: ProviderFailoverTarget) =>
        input.entries.find((entry) => entry.instanceId === target.modelSelection.instanceId)
          ?.driverKind;
      return (
        Number(driverOf(left) === source?.driverKind) -
        Number(driverOf(right) === source?.driverKind)
      );
    });
}

/** One client action owns its in-flight request; the server guards the source run. */
export async function continueWithProvider(input: {
  readonly pending: { current: boolean };
  readonly targets: ReadonlyArray<ProviderFailoverTarget>;
  readonly target: ProviderFailoverTarget;
  readonly continueWith: (target: ProviderFailoverTarget) => Promise<void>;
}): Promise<void> {
  if (input.pending.current) return;
  const { target } = input;
  if (
    !input.targets.some(
      (candidate) =>
        candidate.modelSelection.instanceId === target.modelSelection.instanceId &&
        candidate.modelSelection.model === target.modelSelection.model,
    )
  )
    throw new Error("This provider is no longer available. Choose another provider.");
  input.pending.current = true;
  try {
    await input.continueWith(target);
  } finally {
    input.pending.current = false;
  }
}
