import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { fiveHourMeter } from "./chatUsageMeter";

const now = Date.parse("2026-10-22T07:00:00Z");
const PHOENIX = "America/Phoenix";
const claude = (extra: Partial<ServerProviderUsageWindow>) => [
  {
    driver: "claudeAgent",
    limits: {
      windows: [
        { id: "five_hour", kind: "session", label: "Session", usedPercent: 0, ...extra } as never,
      ],
    },
  },
];

describe("fiveHourMeter", () => {
  it("is hidden with no Claude account", () => {
    expect(fiveHourMeter([], now)).toBeNull();
    expect(
      fiveHourMeter([{ driver: "codex", limits: { windows: claude({})[0]!.limits.windows } }], now),
    ).toBeNull();
  });

  it("reads 0 percent as an empty bar at the normal level", () => {
    expect(fiveHourMeter(claude({ usedPercent: 0 }), now, PHOENIX)).toMatchObject({
      percent: 0,
      fill: 0,
      level: "normal",
    });
  });

  it("names the percent and the reset time in the tooltip", () => {
    const meter = fiveHourMeter(
      claude({ usedPercent: 42, resetsAt: "2026-10-22T08:10:00Z" }),
      now,
      PHOENIX,
    );
    expect(meter).toMatchObject({ percent: 42, fill: 42, level: "normal" });
    expect(meter?.tip).toBe("Claude 5-hour window: 42 percent used, resets 1:10 AM");
  });

  it("warns only above 80 percent", () => {
    expect(fiveHourMeter(claude({ usedPercent: 80 }), now)?.level).toBe("normal");
    expect(fiveHourMeter(claude({ usedPercent: 85 }), now)?.level).toBe("warning");
  });

  it("caps the bar at 100 percent and warns", () => {
    expect(fiveHourMeter(claude({ usedPercent: 100 }), now)).toMatchObject({
      percent: 100,
      fill: 100,
      level: "warning",
    });
    expect(fiveHourMeter(claude({ usedPercent: 130 }), now)?.fill).toBe(100);
  });

  it("leaves the reset out when the time is unknown", () => {
    expect(fiveHourMeter(claude({ usedPercent: 42 }), now)?.tip).toBe(
      "Claude 5-hour window: 42 percent used",
    );
  });
});
