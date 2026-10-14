import type { HardwareAlert, HardwareLimit } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  formatBytes,
  formatValue,
  historyMetrics,
  limitLevel,
  sparklinePoints,
  systemHealth,
} from "./systemCare.logic";

const alert = (overrides: Partial<HardwareAlert>): HardwareAlert => ({
  id: "a",
  metric: "cpu.temp",
  label: "CPU temperature",
  severity: "warning",
  unit: "°C",
  value: 92,
  peak: 93,
  limit: 92,
  message: "",
  startedAt: 0,
  lastSeenAt: 0,
  resolvedAt: null,
  acknowledged: false,
  threadId: null,
  ...overrides,
});

describe("systemHealth", () => {
  it("ranks open critical alerts first and ignores acknowledged or resolved ones", () => {
    expect(systemHealth([alert({ severity: "critical" }), alert({ id: "b" })], true)).toBe(
      "critical",
    );
    expect(systemHealth([alert({ acknowledged: true })], true)).toBe("good");
    expect(systemHealth([alert({ resolvedAt: 5 })], true)).toBe("good");
    expect(systemHealth([alert({ severity: "drift" })], true)).toBe("warning");
    expect(systemHealth([], false)).toBe("unknown");
  });
});

describe("formatting", () => {
  it("formats readings in their units", () => {
    expect(formatBytes(12282 * 1024 * 1024)).toBe("12.0 GB");
    expect(formatValue(4620, "MHz")).toBe("4.62 GHz");
    expect(formatValue(null, "°C")).toBe("—");
    expect(formatValue(1_048_576, "B/s")).toBe("1.0 MB/s");
  });
});

describe("limitLevel", () => {
  const limit: HardwareLimit = {
    metric: "cpu.temp",
    label: "CPU temperature",
    unit: "°C",
    warn: 92,
    critical: 98,
    sustainSeconds: 60,
    source: "spec",
  };
  it("places a reading against its limit", () => {
    expect(limitLevel(50, limit)).toBe("ok");
    expect(limitLevel(93, limit)).toBe("warning");
    expect(limitLevel(99, limit)).toBe("critical");
    expect(limitLevel(99, undefined)).toBe("ok");
  });
});

describe("charts", () => {
  it("draws a polyline that skips missing readings", () => {
    expect(sparklinePoints([0, null, 100], { min: 0, max: 100, height: 10 })).toBe(
      "0.00,10.00 100.00,0.00",
    );
    expect(sparklinePoints([5])).toBe("");
  });

  it("lists chartable metrics in a stable order", () => {
    expect(
      historyMetrics([
        {
          at: 0,
          avg: { "memory.load": 1, "cpu.temp": 2, "gpu.0.clock": 3, "gpu.0.temp": 4 },
          max: {},
        },
      ]),
    ).toEqual(["cpu.temp", "gpu.0.temp", "memory.load"]);
  });
});
