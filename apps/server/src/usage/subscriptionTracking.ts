import type {
  ServerProviderUsageWindow,
  SubscriptionTokenEstimate,
  UsageTokenTotals,
} from "@t3tools/contracts";
import { UsageTokenTotals as TokenTotals } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

export const WindowCalibration = Schema.Struct({
  baselineAt: Schema.Finite,
  checkedAt: Schema.Finite,
  baselinePercent: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  lastPercent: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  resetsAt: Schema.String,
  totals: TokenTotals,
  samples: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  pendingTokens: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
export type WindowCalibration = typeof WindowCalibration.Type;
export const SubscriptionLedger = Schema.Record(
  Schema.String,
  Schema.Struct({
    accountKey: Schema.String,
    sourceKey: Schema.String,
    windows: Schema.Record(Schema.String, WindowCalibration),
  }),
);
export type SubscriptionLedger = typeof SubscriptionLedger.Type;

export const emptyTotals = (): UsageTokenTotals => ({
  uncachedInputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
});
function addTotals(a: UsageTokenTotals, b: UsageTokenTotals): UsageTokenTotals {
  return {
    uncachedInputTokens: a.uncachedInputTokens + b.uncachedInputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  };
}
const totalTokens = (t: UsageTokenTotals) =>
  t.uncachedInputTokens + t.cachedInputTokens + t.cacheCreationTokens + t.outputTokens;

/** Local token equivalents for the observed workload, never a provider token entitlement. */
export function advanceSubscriptionWindow(
  previous: WindowCalibration | undefined,
  window: ServerProviderUsageWindow,
  checkedAt: number,
  tokens: UsageTokenTotals | null,
): { state: WindowCalibration; estimate: SubscriptionTokenEstimate } {
  const fresh: WindowCalibration = {
    baselineAt: checkedAt,
    checkedAt,
    baselinePercent: window.usedPercent,
    lastPercent: window.usedPercent,
    resetsAt: window.resetsAt ?? "",
    totals: emptyTotals(),
    samples: 0,
    pendingTokens: 0,
  };
  let state = previous ?? fresh;
  let unavailable: string | undefined;
  if (!window.resetsAt || Date.parse(window.resetsAt) <= checkedAt)
    unavailable = "A current reset time is required.";
  else if (
    !["session", "weekly"].includes(window.kind) ||
    /opus|sonnet|haiku/i.test(window.id + " " + window.label)
  )
    unavailable = "This quota needs model-specific token attribution.";
  else if (previous && checkedAt > previous.checkedAt) {
    if (
      previous.resetsAt !== window.resetsAt ||
      window.usedPercent < previous.lastPercent ||
      checkedAt >= Date.parse(previous.resetsAt)
    )
      state = fresh;
    else if (
      tokens === null ||
      (window.usedPercent > previous.lastPercent &&
        totalTokens(tokens) + previous.pendingTokens === 0)
    ) {
      state = fresh;
      unavailable = "Token coverage is incomplete; calibration restarted.";
    } else
      state = {
        ...previous,
        checkedAt,
        lastPercent: window.usedPercent,
        totals: addTotals(previous.totals, tokens),
        samples: previous.samples + 1,
        pendingTokens:
          window.usedPercent > previous.lastPercent
            ? 0
            : previous.pendingTokens + totalTokens(tokens),
      };
  }
  if (unavailable) state = fresh;
  const observedPercent = state.lastPercent - state.baselinePercent;
  const count = totalTokens(state.totals);
  const capacity =
    !unavailable && observedPercent >= 5 && count > 0
      ? Math.round((count * 100) / observedPercent)
      : undefined;
  return {
    state,
    estimate: {
      status: unavailable ? "unavailable" : capacity === undefined ? "collecting" : "estimated",
      message:
        unavailable ??
        (capacity === undefined
          ? "Collecting at least 5 percentage points of paired usage."
          : "Local token equivalent at this workload mix. Outside usage, model mix, caching and quota rounding affect the estimate."),
      observedTokens: state.totals,
      observedPercent,
      samples: state.samples,
      since: DateTime.formatIso(DateTime.makeUnsafe(state.baselineAt)),
      through: DateTime.formatIso(DateTime.makeUnsafe(state.checkedAt)),
      ...(capacity === undefined
        ? {}
        : {
            capacityTokens: capacity,
            remainingTokens: Math.round((capacity * (100 - state.lastPercent)) / 100),
          }),
    },
  };
}
