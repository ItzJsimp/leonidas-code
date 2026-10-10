import type {
  ProviderInstanceId,
  ServerProvider,
  ServerProviderUsageWindow,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";

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

/**
 * Row label in Claude's wording: the session window reads `Session limit`, and
 * the account-wide weekly reads `Weekly · all models` when per-model weeklies
 * sit beside it.
 */
export function planWindowLabel(
  window: ServerProviderUsageWindow,
  windows: ReadonlyArray<ServerProviderUsageWindow>,
): string {
  if (window.kind === "session" && window.label === "Session") return "Session limit";
  if (
    window.kind === "weekly" &&
    window.label === "Weekly" &&
    windows.some((other) => other.kind === "weekly" && other.label.includes("·"))
  ) {
    return "Weekly · all models";
  }
  return window.label;
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
