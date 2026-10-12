import type { ModelSelection, ServerProvider } from "@t3tools/contracts";

import { resolveProviderInstanceDisplayName } from "./providerInstanceDisplay.ts";

export interface ProviderFailoverTarget {
  readonly label: string;
  readonly modelSelection: ModelSelection;
}

/**
 * The model a failover resumes on. Same choice as web's
 * `resolveRecommendedFailoverModel`; the catalog default is Fable 5.1 on Claude,
 * which a rate-limited chat should not silently move to.
 */
function recommendedFailoverModel(entry: ServerProvider) {
  const preferredSlug = entry.driver === "claudeAgent" ? "claude-sonnet-5-5" : "gpt-6.1-sol";
  return (
    entry.models.find((candidate) => candidate.slug === preferredSlug) ??
    entry.models.find((candidate) => candidate.isDefault) ??
    entry.models[0]
  );
}

/**
 * Subscription providers that can take over a chat stopped by a usage limit,
 * for clients that only hold the streamed provider list (mobile). Web applies
 * the same rules to its settings-aware entries in `providerFailover.ts`.
 *
 * Only Claude and Codex subscriptions qualify: API-key providers need an
 * explicit cost choice rather than an incidental failover. Another instance
 * of the limited account, or a provider reporting exhausted quota, is skipped;
 * unreported quota counts as unknown, so the new provider may still refuse.
 * Other-driver targets sort first because they are the likelier escape.
 */
export function selectProviderFailoverTargets(input: {
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly current: ModelSelection;
  readonly supportsHandoff: boolean;
}): ProviderFailoverTarget[] {
  if (!input.supportsHandoff) return [];
  const source = input.providers.find((entry) => entry.instanceId === input.current.instanceId);
  const driverOf = (target: ProviderFailoverTarget) =>
    input.providers.find((entry) => entry.instanceId === target.modelSelection.instanceId)?.driver;
  return input.providers
    .flatMap((entry) => {
      if (
        entry.instanceId === input.current.instanceId ||
        (entry.driver !== "codex" && entry.driver !== "claudeAgent") ||
        !entry.enabled ||
        !entry.installed ||
        entry.availability === "unavailable" ||
        entry.status !== "ready" ||
        (source?.continuation?.groupKey !== undefined &&
          source.continuation.groupKey === entry.continuation?.groupKey) ||
        entry.usageLimits?.windows.some((window) => window.usedPercent >= 100)
      )
        return [];
      const model = recommendedFailoverModel(entry);
      if (!model) return [];
      return [
        {
          label: resolveProviderInstanceDisplayName(entry),
          modelSelection: {
            instanceId: entry.instanceId,
            model: model.slug,
            options: [{ id: "effort", value: "medium" }],
          },
        },
      ];
    })
    .sort(
      (left, right) =>
        Number(driverOf(left) === source?.driver) - Number(driverOf(right) === source?.driver),
    );
}
