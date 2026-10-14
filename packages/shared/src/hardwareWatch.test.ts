import type { HardwareHistoryPoint, HardwareSample } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  ALERT_COOLDOWN_MS,
  applyLimitOverrides,
  defaultLimits,
  emptyAlertEngineState,
  evaluateAlerts,
  findTemperatureDrift,
  mergePoints,
  rollup,
  sampleMetrics,
} from "./hardwareWatch.ts";

const sample = (overrides: Partial<HardwareSample["cpu"]> = {}, gpuTemp = 60): HardwareSample => ({
  at: 0,
  cpu: {
    loadPct: 10,
    coreLoadPct: [10, 10],
    clockMhz: 4000,
    packageTempC: 50,
    maxCoreTempC: 55,
    tjMaxC: 100,
    powerW: null,
    ...overrides,
  },
  memory: { usedBytes: 8, totalBytes: 16 },
  gpus: [
    {
      index: 0,
      name: "RTX 4070",
      loadPct: 5,
      memoryControllerPct: 2,
      vramUsedBytes: 1,
      vramTotalBytes: 4,
      tempC: gpuTemp,
      hotspotC: null,
      slowdownTempC: 84,
      coreClockMhz: 2000,
      memoryClockMhz: 10000,
      powerW: 50,
      powerLimitW: 200,
      fanPct: 30,
      thermalThrottling: false,
      powerThrottling: false,
    },
  ],
  disk: { readBytesPerSec: 0, writeBytesPerSec: 0, activePct: 1 },
  volumes: [{ mount: "C:", label: null, usedBytes: 50, totalBytes: 100 }],
  driveTemps: [],
  sensors: [],
});

describe("sampleMetrics", () => {
  it("flattens readings and skips what a source could not provide", () => {
    const metrics = sampleMetrics(sample({ packageTempC: null, clockMhz: null }));
    expect(metrics["cpu.temp"]).toBe(55);
    expect(metrics["memory.load"]).toBe(50);
    expect(metrics["gpu.0.vram"]).toBe(25);
    expect(metrics["volume.C:.used"]).toBe(50);
    expect("cpu.clock" in metrics).toBe(false);
    expect("gpu.0.hotspot" in metrics).toBe(false);
  });
});

describe("defaultLimits", () => {
  it("derives temperature limits from the parts' own specs", () => {
    const limits = defaultLimits(sample());
    expect(limits.find((limit) => limit.metric === "cpu.temp")).toMatchObject({
      warn: 92,
      critical: 98,
      source: "spec",
    });
    expect(limits.find((limit) => limit.metric === "gpu.0.temp")).toMatchObject({
      warn: 79,
      critical: 84,
      label: "RTX 4070 temperature",
    });
  });

  it("falls back to defaults and lets user overrides win", () => {
    const limits = defaultLimits(sample({ tjMaxC: null }));
    expect(limits.find((limit) => limit.metric === "cpu.temp")?.source).toBe("default");
    const overridden = applyLimitOverrides(limits, { "cpu.temp": { warn: 80, critical: null } });
    expect(overridden.find((limit) => limit.metric === "cpu.temp")).toMatchObject({
      warn: 80,
      critical: 98,
      source: "user",
    });
  });
});

describe("evaluateAlerts", () => {
  const limits = defaultLimits(sample());
  const run = (temps: ReadonlyArray<[at: number, temp: number]>) => {
    let state = emptyAlertEngineState;
    const kinds: string[] = [];
    for (const [at, temp] of temps) {
      const result = evaluateAlerts(state, sampleMetrics(sample({}, temp)), limits, at);
      state = result.state;
      kinds.push(...result.transitions.map((t) => `${t.kind}:${t.alert.severity}`));
    }
    return { state, kinds };
  };

  it("waits for a breach to last before alerting", () => {
    expect(
      run([
        [0, 80],
        [30_000, 80],
      ]).kinds,
    ).toEqual([]);
    expect(
      run([
        [0, 80],
        [60_000, 80],
      ]).kinds,
    ).toEqual(["opened:warning"]);
  });

  it("escalates in place and resolves only below the hysteresis band", () => {
    const { kinds, state } = run([
      [0, 80],
      [60_000, 80],
      [70_000, 85],
      [80_000, 78],
      [90_000, 75],
    ]);
    expect(kinds).toEqual(["opened:warning", "escalated:critical", "resolved:critical"]);
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0]?.peak).toBe(85);
  });

  it("keeps a repeat warning quiet during the cooldown but never a critical one", () => {
    const resolved = run([
      [0, 80],
      [60_000, 80],
      [70_000, 70],
    ]).state;
    const again = (temp: number) =>
      [0, 60_000].reduce(
        (acc, offset) =>
          evaluateAlerts(acc.state, sampleMetrics(sample({}, temp)), limits, 100_000 + offset),
        { state: resolved, transitions: [] as ReturnType<typeof evaluateAlerts>["transitions"] },
      );
    expect(again(80).state.alerts.filter((alert) => alert.resolvedAt === null)).toHaveLength(0);
    expect(again(86).state.alerts.filter((alert) => alert.resolvedAt === null)).toHaveLength(1);
    expect(ALERT_COOLDOWN_MS).toBe(30 * 60_000);
  });
});

describe("history", () => {
  it("rolls up averages and peaks, and merges finer points", () => {
    const point = rollup(0, [{ "cpu.load": 10 }, { "cpu.load": 30 }]);
    expect(point).toEqual({ at: 0, avg: { "cpu.load": 20 }, max: { "cpu.load": 30 } });
    const merged = mergePoints(0, [point, rollup(1, [{ "cpu.load": 60 }])]);
    expect(merged.avg["cpu.load"]).toBe(40);
    expect(merged.max["cpu.load"]).toBe(60);
  });

  it("flags idle temperatures that rose against the machine's own normal", () => {
    const hour = 60 * 60_000;
    const now = 10 * 24 * hour;
    const points: HardwareHistoryPoint[] = [];
    for (let i = 48; i < 24 * 9; i++)
      points.push({ at: now - i * hour, avg: { "cpu.temp": 40, "cpu.load": 5 }, max: {} });
    for (let i = 0; i < 6; i++)
      points.push({ at: now - i * hour, avg: { "cpu.temp": 53, "cpu.load": 5 }, max: {} });
    expect(findTemperatureDrift(points, now)).toEqual([
      { metric: "cpu.temp", baseline: 40, recent: 53 },
    ]);
    // Busy hours do not count: a hot render is not a cooling problem.
    const busy = points.map((point) =>
      point.at > now - 24 * hour ? { ...point, avg: { ...point.avg, "cpu.load": 90 } } : point,
    );
    expect(findTemperatureDrift(busy, now)).toEqual([]);
  });
});
