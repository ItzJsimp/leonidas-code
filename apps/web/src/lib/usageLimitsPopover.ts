import type {
  ModelSelection,
  ProviderInstanceId,
  ServerProvider,
  ServerProviderModel,
  ServerProviderUsageWindow,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { getProviderOptionCurrentValue, getProviderOptionDescriptors } from "@t3tools/shared/model";

import type { ContextWindowSnapshot } from "./contextWindow";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type UsageSeverity = "normal" | "warning" | "critical";

/** Amber from 75% used, red from 90%: the point where a window may run dry this session. */
export function usageSeverity(usedPercent: number): UsageSeverity {
  if (usedPercent >= 90) return "critical";
  if (usedPercent >= 75) return "warning";
  return "normal";
}

/** Whole percent used, clamped to 0..100. */
export function usedPercentLabel(usedPercent: number): number {
  return Math.round(Math.max(0, Math.min(100, usedPercent)));
}

/** `76.4k`, `200k`, `1M`, `950`. */
export function formatTokenCount(value: number): string {
  const tokens = Math.max(0, value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (tokens < 1_000) return `${Math.round(tokens)}`;
  if (tokens < 1_000_000) {
    // 999.95k would round up to "1000k"; read it as the next unit instead.
    const k = tokens / 1_000;
    return k >= 999.95 ? "1M" : `${trim(k)}k`;
  }
  return `${trim(tokens / 1_000_000)}M`;
}

/**
 * `Resets in 1 hr 42 min` inside a day, otherwise `Resets <formatAt>` (for
 * example `Resets Sun 9:00 PM`). `formatAt` owns locale and clock style.
 */
export function formatResetLabel(
  resetsAt: string | undefined,
  now: number,
  formatAt: (at: number) => string,
): string | null {
  if (resetsAt === undefined) return null;
  const at = Date.parse(resetsAt);
  if (!Number.isFinite(at)) return null;
  const left = at - now;
  if (left <= 0) return "Resets now";
  if (left >= DAY) return `Resets ${formatAt(at)}`;
  // Rounded up, so the countdown never reads "0 min" before the reset lands.
  const totalMinutes = Math.ceil(left / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `Resets in ${minutes} min`;
  if (minutes === 0) return `Resets in ${hours} hr`;
  return `Resets in ${hours} hr ${minutes} min`;
}

function windowRank(window: ServerProviderUsageWindow): number {
  if (window.kind === "session") return 0;
  // The account-wide weekly before per-model weeklies (`Weekly · <model>`).
  if (window.kind === "weekly") return window.label.includes("·") ? 2 : 1;
  return 3;
}

/** Session first, then the account-wide weekly, then everything else in report order. */
export function orderPlanWindows(
  windows: ReadonlyArray<ServerProviderUsageWindow>,
): ServerProviderUsageWindow[] {
  return windows
    .map((window, index) => ({ window, index }))
    .toSorted((a, b) => windowRank(a.window) - windowRank(b.window) || a.index - b.index)
    .map(({ window }) => window);
}

/** Row label in Claude's wording: `Session limit` and `Weekly · all models`. */
export function planWindowLabel(window: ServerProviderUsageWindow): string {
  if (window.kind === "session" && window.label === "Session") return "Session limit";
  // The plain weekly is account-wide; per-model weeklies are named `Weekly · <model>`.
  if (window.kind === "weekly" && window.label === "Weekly") return "Weekly · all models";
  return window.label;
}

const PLAN_BRAND_PREFIX = /^(?:claude|chatgpt|codex|cursor|grok|opencode|gemini)\s+/i;
const PLAN_SUFFIX = /\s+(?:subscription|plan)$/i;

/** `Claude Pro Subscription` reads `Pro`, `ChatGPT Plus Subscription` reads `Plus`. */
export function shortPlanName(plan: string): string {
  const short = plan.trim().replace(PLAN_SUFFIX, "").replace(PLAN_BRAND_PREFIX, "").trim();
  return short || plan.trim();
}

/** `1m`, `1M`, `200k`, `128000` as tokens; null when the value is not a size. */
export function parseContextWindowSize(value: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([km])?\s*$/i.exec(value);
  if (!match) return null;
  const unit = match[2]?.toLowerCase();
  const tokens = Number(match[1]) * (unit === "m" ? 1_000_000 : unit === "k" ? 1_000 : 1);
  return Number.isFinite(tokens) && tokens > 0 ? tokens : null;
}

/**
 * The model's context window in tokens: the size its `contextWindow` option
 * selects when it offers the choice, otherwise the fixed size the server sends.
 */
export function contextWindowTokensForModel(
  model: Pick<ServerProviderModel, "capabilities" | "contextWindowTokens"> | null | undefined,
  selection: ModelSelection | null | undefined,
): number | null {
  if (!model) return null;
  const descriptor = model.capabilities
    ? getProviderOptionDescriptors({
        caps: model.capabilities,
        selections: selection?.options,
      }).find((candidate) => candidate.id === "contextWindow")
    : undefined;
  const value = getProviderOptionCurrentValue(descriptor, selection);
  const selected = typeof value === "string" ? parseContextWindowSize(value) : null;
  return selected ?? model.contextWindowTokens ?? null;
}

/**
 * The thread's snapshot with the model's window filled in when the provider
 * has not reported one yet, or an empty `0 / <size>` snapshot before the
 * first report. Null when neither usage nor the size is known.
 */
export function withKnownContextWindow(
  snapshot: ContextWindowSnapshot | null,
  modelMaxTokens: number | null,
): ContextWindowSnapshot | null {
  if (snapshot && snapshot.maxTokens != null && snapshot.maxTokens > 0) return snapshot;
  if (modelMaxTokens === null) return snapshot;
  const usedTokens = snapshot?.usedTokens ?? 0;
  const usedPercentage = Math.min(100, (usedTokens / modelMaxTokens) * 100);
  const sized = {
    maxTokens: modelMaxTokens,
    remainingTokens: Math.max(0, Math.round(modelMaxTokens - usedTokens)),
    usedPercentage,
    remainingPercentage: Math.max(0, 100 - usedPercentage),
  };
  if (snapshot) return { ...snapshot, ...sized };
  return {
    usedTokens: 0,
    totalProcessedTokens: null,
    ...sized,
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    lastUsedTokens: null,
    lastInputTokens: null,
    lastCachedInputTokens: null,
    lastOutputTokens: null,
    lastReasoningOutputTokens: null,
    toolUses: null,
    durationMs: null,
    compactsAutomatically: null,
    autoCompactThreshold: null,
    cost: null,
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * Highest usage across the provider's own windows and any hub accounts for
 * the same driver, or null when nothing reports. Cheap enough to run while
 * the popover is closed so the trigger can carry the warning colour.
 */
export function peakUsedPercent(
  instanceId: ProviderInstanceId,
  providers: readonly ServerProvider[],
  sources: UsageLimitSourceSnapshots,
): number | null {
  const selected = providers.find((provider) => provider.instanceId === instanceId);
  if (!selected) return null;
  let peak: number | null = null;
  const take = (windows: ReadonlyArray<ServerProviderUsageWindow> | undefined) => {
    for (const window of windows ?? []) {
      peak = Math.max(peak ?? 0, window.usedPercent);
    }
  };
  for (const provider of providers) {
    if (provider.driver === selected.driver && !provider.usageLimits?.unavailable) {
      take(provider.usageLimits?.windows);
    }
  }
  for (const source of sources) {
    for (const account of source.accounts) {
      if (account.driver === selected.driver && !account.usageLimits.unavailable) {
        take(account.usageLimits.windows);
      }
    }
  }
  return peak;
}
