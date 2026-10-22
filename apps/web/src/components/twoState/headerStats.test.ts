import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { builtInStats, claudeFiveHour } from "./headerStats";

const now = Date.parse("2026-10-21T21:00:00-07:00");
const window = (extra: Partial<ServerProviderUsageWindow>): ServerProviderUsageWindow =>
  ({ id: "five_hour", kind: "session", label: "Session", usedPercent: 42, ...extra }) as never;

describe("builtInStats", () => {
  it("shows the same counts as the status line and rails", () => {
    expect(
      builtInStats({ needsYou: 2, running: 3, today: { done: 1, total: 4 } }, 42).map(
        (stat) => `${stat.label} ${stat.value}`,
      ),
    ).toEqual(["Needs you 2", "Running 3", "Today 1/4", "Claude 5h 42%"]);
  });

  it("leaves out Claude when no Claude account reports a 5-hour window", () => {
    const stats = builtInStats({ needsYou: 0, running: 0, today: null }, null);
    expect(stats.map((stat) => stat.id)).toEqual(["needs-you", "running", "today"]);
    expect(stats[2]?.value).toBe("0/0");
  });
});

describe("claudeFiveHour", () => {
  it("reads the Claude account's five-hour window, rounded", () => {
    const accounts = [
      { driver: "codex", limits: { windows: [window({ usedPercent: 90 })] } },
      {
        driver: "claudeAgent",
        limits: { windows: [window({ id: "seven_day" }), window({ usedPercent: 41.6 })] },
      },
    ];
    expect(claudeFiveHour(accounts, now)).toBe(42);
  });

  it("reads 0 once the window has reset, and null with no Claude account", () => {
    const reset = [
      {
        driver: "claudeAgent",
        limits: { windows: [window({ resetsAt: "2026-10-21T20:00:00-07:00" })] },
      },
    ];
    expect(claudeFiveHour(reset, now)).toBe(0);
    expect(claudeFiveHour([], now)).toBeNull();
  });
});
