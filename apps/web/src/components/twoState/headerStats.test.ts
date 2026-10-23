import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { claudeFiveHour } from "./headerStats";

const now = Date.parse("2026-10-21T21:00:00-07:00");
const window = (extra: Partial<ServerProviderUsageWindow>): ServerProviderUsageWindow =>
  ({ id: "five_hour", kind: "session", label: "Session", usedPercent: 42, ...extra }) as never;

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
