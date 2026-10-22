import type { ServerProviderUsageWindow } from "@t3tools/contracts";

import { expireElapsedWindow } from "~/lib/usageLimitsPopover";

import type { StatusCounts } from "./copy";

export interface HeaderStat {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly tip: string;
}

/** Needs you, Running, Today and Claude 5h, from the counts the status line and rails use. */
export function builtInStats(counts: StatusCounts, claudePercent: number | null): HeaderStat[] {
  const today = counts.today ?? { done: 0, total: 0 };
  const stats: HeaderStat[] = [
    {
      id: "needs-you",
      label: "Needs you",
      value: counts.needsYou,
      tip: "Unread questions, permission requests and failures. The right rail lists them.",
    },
    {
      id: "running",
      label: "Running",
      value: counts.running,
      tip: "Chats with an agent working now.",
    },
    {
      id: "today",
      label: "Today",
      value: `${today.done}/${today.total}`,
      tip: "Today's priorities done, of all priorities in the daily brief.",
    },
  ];
  if (claudePercent !== null) {
    stats.push({
      id: "claude-5h",
      label: "Claude 5h",
      value: `${claudePercent}%`,
      tip: "Claude's own 5-hour usage meter: the part of this window already used.",
    });
  }
  return stats;
}

/** Percent used of the Claude 5-hour window, or null when no Claude account reports one. */
export function claudeFiveHour(
  accounts: ReadonlyArray<{
    readonly driver: string;
    readonly limits: { readonly windows: ReadonlyArray<ServerProviderUsageWindow> };
  }>,
  now: number,
): number | null {
  for (const account of accounts) {
    if (account.driver !== "claudeAgent") continue;
    const window = account.limits.windows.find(
      (candidate) => candidate.id === "five_hour" || candidate.windowDurationMins === 300,
    );
    if (window) return Math.round(expireElapsedWindow(window, now).usedPercent);
  }
  return null;
}
