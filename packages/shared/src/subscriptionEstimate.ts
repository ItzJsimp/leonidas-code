import type { SubscriptionTokenEstimate } from "@t3tools/contracts";
export function subscriptionEstimateSummary(estimate: SubscriptionTokenEstimate): string {
  const t = estimate.observedTokens;
  const count =
    t.uncachedInputTokens + t.cachedInputTokens + t.cacheCreationTokens + t.outputTokens;
  const format = (n: number) =>
    new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  if (estimate.capacityTokens === undefined) return estimate.message;
  return `${format(count)} recorded tokens / ${estimate.observedPercent.toFixed(1)} percentage points · ~${format(estimate.capacityTokens)} tokens at 100% · ~${format(estimate.remainingTokens ?? 0)} left`;
}
