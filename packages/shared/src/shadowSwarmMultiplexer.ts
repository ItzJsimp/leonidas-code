import { computeMaxUsedPercent, type QuotaWindowSnapshot } from "./predictiveQuotaHandoff.ts";

export interface SwarmAccountProfile {
  readonly providerInstanceId: string;
  readonly driverKind: string;
  readonly identityKeys?: readonly string[] | undefined;
  readonly modelIds: readonly string[];
  readonly windows: readonly QuotaWindowSnapshot[];
  readonly available: boolean;
  readonly isRateLimited?: boolean | undefined;
}

export interface MultiplexSelectionResult {
  readonly selectedAccount: SwarmAccountProfile;
  readonly alternateAccounts: readonly SwarmAccountProfile[];
  readonly usedPercent: number;
  readonly reason: string;
}

export function isAccountAvailable(account: SwarmAccountProfile, nowMs: number): boolean {
  const usedPercent = computeMaxUsedPercent(account.windows, nowMs);
  return (
    account.available &&
    account.isRateLimited !== true &&
    usedPercent !== undefined &&
    usedPercent < 100
  );
}

/** Route background work to a healthier account only when it serves the same model. */
export function selectOptimalSwarmAccount(input: {
  readonly accounts: readonly SwarmAccountProfile[];
  readonly currentInstanceId: string;
  readonly driverKind: string;
  readonly modelId: string;
  readonly nowMs: number;
}): MultiplexSelectionResult | undefined {
  const nowMs = input.nowMs;
  const current = input.accounts.find(
    (account) => account.providerInstanceId === input.currentInstanceId,
  );
  const currentUsed =
    current === undefined ? undefined : computeMaxUsedPercent(current.windows, nowMs);
  if (current === undefined || currentUsed === undefined) return undefined;

  const eligible = input.accounts
    .filter(
      (account) =>
        account.providerInstanceId !== input.currentInstanceId &&
        account.driverKind === input.driverKind &&
        account.modelIds.includes(input.modelId) &&
        !(account.identityKeys ?? []).some((key) => (current.identityKeys ?? []).includes(key)) &&
        isAccountAvailable(account, nowMs),
    )
    .map((account, index) => ({
      account,
      index,
      usedPercent: computeMaxUsedPercent(account.windows, nowMs)!,
    }))
    .filter(({ usedPercent }) => usedPercent < currentUsed)
    .sort((left, right) => left.usedPercent - right.usedPercent || left.index - right.index);

  const best = eligible[0];
  if (best === undefined) return undefined;
  return {
    selectedAccount: best.account,
    alternateAccounts: eligible.slice(1).map(({ account }) => account),
    usedPercent: best.usedPercent,
    reason: `Selected a same-model account at ${Math.round(best.usedPercent)}% quota usage for background work.`,
  };
}
