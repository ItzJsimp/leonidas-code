export type ExhaustionRisk = "nominal" | "elevated" | "imminent" | "exhausted";

export interface QuotaWindowSnapshot {
  readonly usedPercent: number;
  readonly resetsAt?: string | undefined;
  readonly tokenEstimate?:
    | {
        readonly status: "collecting" | "estimated" | "unavailable";
        readonly remainingTokens?: number | undefined;
        readonly capacityTokens?: number | undefined;
      }
    | undefined;
}

export interface PredictiveQuotaAccountCandidate {
  readonly providerInstanceId: string;
  readonly accountLabel: string;
  readonly driverKind: string;
  readonly identityKeys?: readonly string[] | undefined;
  readonly modelIds?: readonly string[] | undefined;
  readonly windows: readonly QuotaWindowSnapshot[];
  readonly isRateLimited?: boolean | undefined;
}

export interface PredictiveQuotaInput {
  readonly currentAccount: PredictiveQuotaAccountCandidate;
  readonly recentTurnTokenUsages?: readonly number[] | undefined;
  readonly estimatedUpcomingTurnTokens?: number | undefined;
  readonly candidateAccounts?: readonly PredictiveQuotaAccountCandidate[] | undefined;
  readonly nowMs: number;
  readonly imminentThresholdPercent?: number | undefined;
  readonly elevatedThresholdPercent?: number | undefined;
}

export interface PredictiveQuotaEvaluation {
  readonly currentUsedPercent: number | null;
  readonly exhaustionRisk: ExhaustionRisk;
  readonly predictedTurnsRemaining?: number | undefined;
  readonly shouldPreemptivelyHandoff: boolean;
  readonly reason?: string | undefined;
  readonly recommendedAccount?: PredictiveQuotaAccountCandidate | undefined;
}

const DEFAULT_IMMINENT_THRESHOLD = 90;
const DEFAULT_ELEVATED_THRESHOLD = 80;

function isExpired(window: QuotaWindowSnapshot, nowMs: number): boolean {
  if (window.resetsAt === undefined) return false;
  const resetAt = Date.parse(window.resetsAt);
  return Number.isFinite(resetAt) && resetAt <= nowMs;
}

function activeWindows(
  windows: readonly QuotaWindowSnapshot[],
  nowMs: number,
): readonly QuotaWindowSnapshot[] {
  return windows.filter((window) => !isExpired(window, nowMs));
}

export function computeMaxUsedPercent(
  windows: readonly QuotaWindowSnapshot[],
  nowMs: number,
): number | undefined {
  const active = activeWindows(windows, nowMs);
  if (active.length === 0) return undefined;
  return Math.max(...active.map((window) => Math.min(100, Math.max(0, window.usedPercent))));
}

function isExhausted(account: PredictiveQuotaAccountCandidate, nowMs: number): boolean {
  return (
    account.isRateLimited === true ||
    activeWindows(account.windows, nowMs).some((window) => window.usedPercent >= 100)
  );
}

function remainingTokenEstimates(
  windows: readonly QuotaWindowSnapshot[],
  nowMs: number,
): readonly number[] {
  return activeWindows(windows, nowMs).flatMap((window) => {
    const estimate = window.tokenEstimate;
    if (estimate?.status !== "estimated") return [];
    const remaining =
      estimate.remainingTokens ??
      (estimate.capacityTokens === undefined
        ? undefined
        : Math.floor((estimate.capacityTokens * Math.max(0, 100 - window.usedPercent)) / 100));
    return remaining === undefined || !Number.isFinite(remaining) ? [] : [Math.max(0, remaining)];
  });
}

export function estimateAverageTurnCost(
  recentUsages: readonly number[] = [],
  fallbackTokens?: number,
): number | undefined {
  const samples = recentUsages.filter((value) => Number.isFinite(value) && value > 0);
  if (samples.length === 0) {
    return fallbackTokens !== undefined && Number.isFinite(fallbackTokens) && fallbackTokens > 0
      ? Math.ceil(fallbackTokens)
      : undefined;
  }
  return Math.ceil(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

export function calculateTurnsRemaining(
  windows: readonly QuotaWindowSnapshot[],
  averageTurnTokens: number | undefined,
  nowMs: number,
): number | undefined {
  if (averageTurnTokens === undefined || averageTurnTokens <= 0) return undefined;
  const estimates = remainingTokenEstimates(windows, nowMs);
  return estimates.length === 0
    ? undefined
    : Math.min(...estimates.map((remaining) => Math.floor(remaining / averageTurnTokens)));
}

export function rankCandidateAccounts(
  candidates: readonly PredictiveQuotaAccountCandidate[],
  currentInstanceId: string,
  nowMs: number,
  currentIdentityKeys: readonly string[] = [],
): readonly PredictiveQuotaAccountCandidate[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.providerInstanceId !== currentInstanceId &&
        candidate.isRateLimited !== true &&
        !(candidate.identityKeys ?? []).some((key) => currentIdentityKeys.includes(key)) &&
        !isExhausted(candidate, nowMs),
    )
    .map((candidate, index) => ({
      candidate,
      index,
      usedPercent: computeMaxUsedPercent(candidate.windows, nowMs),
    }))
    .filter((entry) => entry.usedPercent !== undefined)
    .sort((left, right) => left.usedPercent! - right.usedPercent! || left.index - right.index)
    .map(({ candidate }) => candidate);
}

export function evaluatePredictiveQuota(input: PredictiveQuotaInput): PredictiveQuotaEvaluation {
  const nowMs = input.nowMs;
  const imminentThreshold = input.imminentThresholdPercent ?? DEFAULT_IMMINENT_THRESHOLD;
  const elevatedThreshold = input.elevatedThresholdPercent ?? DEFAULT_ELEVATED_THRESHOLD;
  const currentUsed = computeMaxUsedPercent(input.currentAccount.windows, nowMs);
  const exhausted = isExhausted(input.currentAccount, nowMs);
  const averageTokens = estimateAverageTurnCost(
    input.recentTurnTokenUsages,
    input.estimatedUpcomingTurnTokens,
  );
  const predictedTurns = calculateTurnsRemaining(
    input.currentAccount.windows,
    averageTokens,
    nowMs,
  );
  const remaining = remainingTokenEstimates(input.currentAccount.windows, nowMs);
  const nextTurnEstimate = input.estimatedUpcomingTurnTokens ?? averageTokens;
  const nextTurnMayExceedQuota =
    nextTurnEstimate !== undefined &&
    remaining.length > 0 &&
    nextTurnEstimate > Math.min(...remaining);

  let exhaustionRisk: ExhaustionRisk = "nominal";
  let shouldPreemptivelyHandoff = false;
  let reason: string | undefined;

  if (exhausted) {
    exhaustionRisk = "exhausted";
    shouldPreemptivelyHandoff = true;
    reason = "The current quota window is exhausted.";
  } else if (
    currentUsed !== undefined &&
    (currentUsed >= imminentThreshold || predictedTurns === 0 || nextTurnMayExceedQuota)
  ) {
    exhaustionRisk = "imminent";
    shouldPreemptivelyHandoff = true;
    reason = nextTurnMayExceedQuota
      ? "The measured quota estimate is smaller than a typical upcoming turn."
      : `Quota usage is ${Math.round(currentUsed)}%; switch before starting more background work.`;
  } else if (
    currentUsed !== undefined &&
    (currentUsed >= elevatedThreshold || predictedTurns === 1)
  ) {
    exhaustionRisk = "elevated";
    reason = `Quota usage is ${Math.round(currentUsed)}%${
      predictedTurns === undefined
        ? ""
        : `, with about ${predictedTurns} measured turn(s) remaining`
    }.`;
  }

  const recommendedAccount = shouldPreemptivelyHandoff
    ? rankCandidateAccounts(
        input.candidateAccounts ?? [],
        input.currentAccount.providerInstanceId,
        nowMs,
        input.currentAccount.identityKeys,
      ).find((candidate) => {
        const candidateUsed = computeMaxUsedPercent(candidate.windows, nowMs);
        return (
          candidateUsed !== undefined && (currentUsed === undefined || candidateUsed < currentUsed)
        );
      })
    : undefined;

  return {
    currentUsedPercent: currentUsed ?? null,
    exhaustionRisk,
    ...(predictedTurns === undefined ? {} : { predictedTurnsRemaining: predictedTurns }),
    shouldPreemptivelyHandoff,
    ...(reason === undefined ? {} : { reason }),
    ...(recommendedAccount === undefined ? {} : { recommendedAccount }),
  };
}
