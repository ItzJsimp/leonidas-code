import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  formatResetLabel,
  formatTokenCount,
  orderPlanWindows,
  planWindowLabel,
  usageSeverity,
} from "./usageLimitsPopover";

const window = (
  id: string,
  kind: ServerProviderUsageWindow["kind"],
  label: string,
): ServerProviderUsageWindow => ({ id, kind, label, usedPercent: 10 });

describe("usage limits popover helpers", () => {
  it("grades usage at 75% and 90%", () => {
    expect(usageSeverity(74.9)).toBe("normal");
    expect(usageSeverity(75)).toBe("warning");
    expect(usageSeverity(89)).toBe("warning");
    expect(usageSeverity(90)).toBe("critical");
    expect(usageSeverity(100)).toBe("critical");
  });

  it("formats token counts like the Claude popover", () => {
    expect(formatTokenCount(950)).toBe("950");
    expect(formatTokenCount(76_400)).toBe("76.4k");
    expect(formatTokenCount(200_000)).toBe("200k");
    expect(formatTokenCount(999_990)).toBe("1M");
    expect(formatTokenCount(1_000_000)).toBe("1M");
    expect(formatTokenCount(1_500_000)).toBe("1.5M");
  });

  it("counts down inside a day and names the moment beyond it", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    const at = (ms: number) => new Date(now + ms).toISOString();
    const formatAt = () => "Sun 9:00 PM";
    expect(formatResetLabel(undefined, now, formatAt)).toBeNull();
    expect(formatResetLabel(at(-1), now, formatAt)).toBe("Resets now");
    expect(formatResetLabel(at(30_000), now, formatAt)).toBe("Resets in 1 min");
    expect(formatResetLabel(at(42 * 60_000), now, formatAt)).toBe("Resets in 42 min");
    expect(formatResetLabel(at(102 * 60_000), now, formatAt)).toBe("Resets in 1 hr 42 min");
    expect(formatResetLabel(at(2 * 3_600_000), now, formatAt)).toBe("Resets in 2 hr");
    expect(formatResetLabel(at(3 * 86_400_000), now, formatAt)).toBe("Resets Sun 9:00 PM");
  });

  it("puts session, then the account weekly, then the rest", () => {
    const windows = [
      window("model", "weekly", "Weekly · Fable"),
      window("other", "other", "Credits"),
      window("weekly", "weekly", "Weekly"),
      window("session", "session", "Session"),
    ];
    expect(orderPlanWindows(windows).map((w) => w.id)).toEqual([
      "session",
      "weekly",
      "model",
      "other",
    ]);
    expect(planWindowLabel(windows[3]!, windows)).toBe("Session limit");
    expect(planWindowLabel(windows[2]!, windows)).toBe("Weekly · all models");
    expect(planWindowLabel(windows[2]!, [windows[2]!])).toBe("Weekly");
    expect(planWindowLabel(windows[0]!, windows)).toBe("Weekly · Fable");
  });
});
