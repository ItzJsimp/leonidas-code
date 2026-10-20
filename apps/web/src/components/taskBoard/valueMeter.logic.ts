import type { UsageProviderKind } from "@t3tools/contracts";

export function buildValueMeter(input: {
  providers: ReadonlyArray<{ provider: UsageProviderKind; costUsd: number; records: number }>;
  models: ReadonlyArray<{ provider: UsageProviderKind; records: number; unpricedRecords: number }>;
  paid: Readonly<Record<string, number>>;
  pricingSource: string;
  providerKinds?: ReadonlyArray<string>;
}) {
  const providers = new Set([
    ...(input.providerKinds ?? []),
    ...input.providers.map((row) => row.provider),
    ...Object.keys(input.paid),
  ]);
  return [...providers].sort().map((provider) => {
    const usage = input.providers.find((row) => row.provider === provider);
    const unpricedRecords = input.models
      .filter((row) => row.provider === provider)
      .reduce((sum, row) => sum + row.unpricedRecords, 0);
    const valueUsd =
      !usage || (usage.records > 0 && unpricedRecords >= usage.records) ? null : usage.costUsd;
    const paidUsd = input.paid[provider] ?? null;
    return {
      provider,
      paidUsd,
      valueUsd,
      unpricedRecords,
      savingsUsd: valueUsd === null || paidUsd === null ? null : valueUsd - paidUsd,
      valueSource: `estimate: ${input.pricingSource} and provider usage records`,
      savingsSource: "estimate: list-price value minus user-entered paid amount",
    };
  });
}
