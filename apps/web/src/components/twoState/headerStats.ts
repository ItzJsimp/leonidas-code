import type { ServerProviderUsageWindow } from "@t3tools/contracts";

import { expireElapsedWindow } from "~/lib/usageLimitsPopover";

type UsageAccount = {
  readonly driver: string;
  readonly limits: { readonly windows: ReadonlyArray<ServerProviderUsageWindow> };
};

/** The Claude 5-hour window, read as fresh once its reset time has passed, or null. */
export function claudeFiveHourWindow(
  accounts: ReadonlyArray<UsageAccount>,
  now: number,
): ServerProviderUsageWindow | null {
  for (const account of accounts) {
    if (account.driver !== "claudeAgent") continue;
    const window = account.limits.windows.find(
      (candidate) => candidate.id === "five_hour" || candidate.windowDurationMins === 300,
    );
    if (window) return expireElapsedWindow(window, now);
  }
  return null;
}

/** Percent used of the Claude 5-hour window, or null when no Claude account reports one. */
export function claudeFiveHour(accounts: ReadonlyArray<UsageAccount>, now: number): number | null {
  const window = claudeFiveHourWindow(accounts, now);
  return window ? Math.round(window.usedPercent) : null;
}
