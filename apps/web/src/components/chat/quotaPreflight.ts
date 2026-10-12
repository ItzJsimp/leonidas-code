import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import {
  evaluatePredictiveQuota,
  type QuotaWindowSnapshot,
} from "@t3tools/shared/predictiveQuotaHandoff";

import type { ProviderFailoverTarget } from "./providerFailover";

export interface QuotaPreflightAdvice {
  readonly target: ProviderFailoverTarget;
  readonly usedPercent: number | null;
}

/**
 * Warns before the next turn when the current account is about to run out, so
 * the switch lands on the next send instead of after a turn has already stopped.
 * An exhausted account stays with the usage-limit banner, which handles a stopped turn.
 */
export function getQuotaPreflightAdvice(input: {
  readonly current: {
    readonly instanceId: string;
    readonly driverKind: string;
    readonly label: string;
    readonly windows: ReadonlyArray<ServerProviderUsageWindow>;
  };
  readonly recentTurnTokenUsages: ReadonlyArray<number>;
  readonly targets: ReadonlyArray<ProviderFailoverTarget>;
  readonly nowMs: number;
}): QuotaPreflightAdvice | null {
  // Targets arrive ordered with another provider first, and they already exclude exhausted accounts.
  const target = input.targets[0];
  if (target === undefined) return null;
  const evaluation = evaluatePredictiveQuota({
    currentAccount: {
      providerInstanceId: input.current.instanceId,
      accountLabel: input.current.label,
      driverKind: input.current.driverKind,
      windows: input.current.windows.map(toQuotaWindowSnapshot),
    },
    recentTurnTokenUsages: input.recentTurnTokenUsages,
    nowMs: input.nowMs,
  });
  if (evaluation.exhaustionRisk !== "imminent") return null;
  return { target, usedPercent: evaluation.currentUsedPercent };
}

/**
 * The busiest usage window at or above the user's warning threshold, or null.
 * An exhausted account stays with the usage-limit banner, so 100% and above is left to it.
 */
export function getUsageWarning(input: {
  readonly windows: ReadonlyArray<ServerProviderUsageWindow>;
  readonly thresholdPercent: number | null;
}): { readonly usedPercent: number } | null {
  if (input.thresholdPercent === null) return null;
  const busiest = Math.max(-1, ...input.windows.map((window) => window.usedPercent));
  return busiest >= input.thresholdPercent && busiest < 100 ? { usedPercent: busiest } : null;
}

function toQuotaWindowSnapshot(window: ServerProviderUsageWindow): QuotaWindowSnapshot {
  return {
    usedPercent: window.usedPercent,
    ...(window.resetsAt === undefined ? {} : { resetsAt: window.resetsAt }),
    ...(window.tokenEstimate === undefined ? {} : { tokenEstimate: window.tokenEstimate }),
  };
}
