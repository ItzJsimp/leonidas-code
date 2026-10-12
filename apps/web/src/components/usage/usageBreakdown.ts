import type { UsageTokenTotals } from "@t3tools/contracts";
import {
  isModelCostUnknown,
  type CategoryCost,
  type MergedUsage,
  type ModelTotals,
  type SpeedCost,
} from "@t3tools/shared/usageMerge";

import type { ShareSegment } from "./UsageShareBar";

export function sortModelsByTokens(models: readonly ModelTotals[]) {
  return models.toSorted(
    (left, right) => right.totalTokens - left.totalTokens || right.costUsd - left.costUsd,
  );
}

/**
 * A model's share of the selected metric, or `null` for a cost share of an
 * unknown cost. An unpriced model still has a real token share.
 */
export function modelShare(model: ModelTotals, metric: "cost" | "tokens"): number | null {
  if (metric === "tokens") return model.tokenShare;
  return isModelCostUnknown(model) ? null : model.costShare;
}

/**
 * Share of a model's input read from cache, or `null` without input. Cache
 * writes count as misses: that input was processed in full.
 */
export function cacheHitRate({ tokens }: ModelTotals): number | null {
  const input = tokens.uncachedInputTokens + tokens.cachedInputTokens + tokens.cacheCreationTokens;
  return input === 0 ? null : tokens.cachedInputTokens / input;
}

/** Effective USD per million priced tokens, or `null` when none were priced. */
export function costPerMillionTokens(model: ModelTotals): number | null {
  const pricedTokens = model.totalTokens - model.unpricedTokens;
  return pricedTokens <= 0 || isModelCostUnknown(model)
    ? null
    : (model.costUsd / pricedTokens) * 1_000_000;
}

/** A neutral step between background and foreground, so mixes never borrow a provider's color. */
const ink = (percent: number) =>
  `color-mix(in oklab, var(--foreground) ${percent}%, var(--background))`;

/** Adjacent segments stay above the 15 ΔE separation floor in both themes. */
const TYPE_COLORS = {
  input: ink(60),
  cacheRead: ink(30),
  cacheWrite: ink(72),
  output: ink(100),
  other: ink(44),
};

export function costTypeSegments(cost: CategoryCost): readonly ShareSegment[] {
  return [
    { label: "Input", value: cost.input, color: TYPE_COLORS.input },
    { label: "Cache read", value: cost.cacheRead, color: TYPE_COLORS.cacheRead },
    { label: "Cache write", value: cost.cacheWrite, color: TYPE_COLORS.cacheWrite },
    { label: "Output", value: cost.output, color: TYPE_COLORS.output },
    // Reported cost with no rates to split it, or from older servers. Below a
    // cent it is rounding, not usage.
    { label: "Other", value: cost.unsplit >= 0.005 ? cost.unsplit : 0, color: TYPE_COLORS.other },
  ];
}

export function tokenTypeSegments(
  tokens: Omit<UsageTokenTotals, "reasoningTokens">,
): readonly ShareSegment[] {
  return [
    { label: "Input", value: tokens.uncachedInputTokens, color: TYPE_COLORS.input },
    { label: "Cache read", value: tokens.cachedInputTokens, color: TYPE_COLORS.cacheRead },
    { label: "Cache write", value: tokens.cacheCreationTokens, color: TYPE_COLORS.cacheWrite },
    { label: "Output", value: tokens.outputTokens, color: TYPE_COLORS.output },
  ];
}

/** Speeds are ordered by price, so they brighten from standard to ultrafast. */
export function speedCostSegments(cost: SpeedCost): readonly ShareSegment[] {
  return [
    { label: "Standard", value: cost.standard, color: ink(34) },
    { label: "Fast", value: cost.fast, color: ink(66) },
    { label: "Ultrafast", value: cost.ultrafast, color: ink(100) },
  ];
}

/** Placeholder ids the readers emit when a record carried no usable model name. */
export function displayModelName(model: string): string {
  return model === "antigravity-unknown" || model === "<synthetic>" ? "Unattributed" : model;
}

export interface UsageHighlight {
  readonly label: string;
  readonly value: string;
  readonly detail?: string | undefined;
}

/**
 * The few figures people open this page to find: where the tokens went, how
 * well the cache worked, and what a session costs. Pure so it can be tested.
 */
export function usageHighlights(
  merged: MergedUsage,
  format: { readonly tokens: (n: number) => string; readonly usd: (n: number) => string },
  percent: (n: number) => string,
): readonly UsageHighlight[] {
  const highlights: UsageHighlight[] = [];
  const top = sortModelsByTokens(merged.models)[0];
  if (top && merged.totalTokens > 0) {
    highlights.push({
      label: "Top model",
      value: displayModelName(top.model),
      detail: `${percent(top.tokenShare)} of tokens`,
    });
  }
  const input = merged.uncachedInputTokens + merged.cachedInputTokens + merged.cacheCreationTokens;
  if (input > 0) {
    highlights.push({
      label: "Cache hit rate",
      value: percent(merged.cachedInputTokens / input),
      detail: `${format.usd(merged.costQuality.cacheSavingsUsd)} saved`,
    });
  }
  if (merged.sessions > 0 && merged.totalTokens > 0) {
    highlights.push({
      label: "Per session",
      value: format.tokens(merged.totalTokens / merged.sessions),
      detail:
        merged.costUsd > 0 ? `${format.usd(merged.costUsd / merged.sessions)} avg` : undefined,
    });
  }
  if (merged.outputTokens > 0 && input > 0) {
    highlights.push({
      label: "Output share",
      value: percent(merged.outputTokens / merged.totalTokens),
      detail: `${format.tokens(merged.outputTokens)} generated`,
    });
  }
  return highlights;
}

/**
 * Models that cost nothing by design: OpenRouter `:free` routes, and models
 * served from this machine (Ollama, LM Studio, llama.cpp style ids). Shown as
 * an explicit $0 instead of "Unpriced", which reads as "we don't know".
 */
export function freeModelKind(model: string): "free" | "local" | null {
  const id = model.toLowerCase();
  if (id.endsWith(":free")) return "free";
  if (/^(ollama|lmstudio|lm-studio|llamacpp|llama\.cpp|local)[/:]/.test(id)) return "local";
  return null;
}
