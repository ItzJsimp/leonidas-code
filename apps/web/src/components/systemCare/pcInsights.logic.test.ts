import type { HardwareInventory, HardwareLimit, HardwareSample } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  ageText,
  beforeAfter,
  healthScore,
  parseDriverDate,
  quickWins,
  speedReached,
  uptimeText,
} from "./pcInsights.logic";

const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 9, 15);

const sample = (overrides: Partial<HardwareSample> = {}): HardwareSample => ({
  at: NOW,
  cpu: {
    loadPct: 20,
    coreLoadPct: [10, 30],
    clockMhz: 4000,
    packageTempC: 50,
    maxCoreTempC: 52,
    tjMaxC: 100,
    powerW: 40,
  },
  memory: { usedBytes: 8, totalBytes: 32 },
  gpus: [],
  disk: { readBytesPerSec: 0, writeBytesPerSec: 0, activePct: 1 },
  volumes: [{ mount: "C:", label: null, mediaType: "ssd", usedBytes: 50, totalBytes: 100 }],
  driveTemps: [],
  sensors: [],
  ...overrides,
});

const limit = (metric: string, warn: number, critical: number): HardwareLimit =>
  ({ metric, label: metric, unit: "%", warn, critical, source: "default" }) as HardwareLimit;

const inventory = (overrides: Partial<HardwareInventory> = {}): HardwareInventory =>
  ({
    platform: "win32",
    os: {
      name: "Windows",
      version: "11",
      architecture: "x64",
      hostname: "pc",
      bootedAt: NOW - DAY,
    },
    cpu: {
      name: "CPU",
      vendor: null,
      cores: 8,
      threads: 16,
      baseClockMhz: null,
      l2CacheKb: null,
      l3CacheKb: null,
      socket: null,
      virtualizationEnabled: null,
    },
    gpus: [],
    memory: { totalBytes: 32, modules: [] },
    disks: [],
    board: { manufacturer: null, product: null, biosVersion: null, biosDate: null },
    ...overrides,
  }) as HardwareInventory;

describe("healthScore", () => {
  it("waits for data, then gives full marks to a calm machine", () => {
    expect(healthScore(null, new Map(), []).score).toBeNull();
    expect(healthScore(sample(), new Map(), []).score).toBe(100);
  });

  it("takes points for readings past their limits, worst reason first", () => {
    const limits = new Map([
      ["memory.load", limit("memory.load", 20, 90)],
      ["volume.C:.used", limit("volume.C:.used", 40, 45)],
    ]);
    const result = healthScore(sample(), limits, []);
    expect(result.score).toBe(72);
    expect(result.reasons[0]).toBe("Drive C: space is past its safe limit");
  });
});

describe("quickWins", () => {
  it("finds slow memory, an old driver, a long uptime and a full drive", () => {
    const wins = quickWins(
      inventory({
        os: {
          name: "W",
          version: "11",
          architecture: "x64",
          hostname: "pc",
          bootedAt: NOW - 9 * DAY,
        },
        gpus: [
          {
            name: "GPU",
            vendor: null,
            driverVersion: "1",
            driverDate: "2025-01-01",
            vramBytes: null,
          },
        ],
        memory: {
          totalBytes: 32,
          modules: [
            {
              slot: "A1",
              capacityBytes: 16,
              speedMts: 6000,
              configuredSpeedMts: 4800,
              manufacturer: null,
              partNumber: null,
            },
          ],
        },
      }),
      sample({
        volumes: [{ mount: "C:", label: null, mediaType: "ssd", usedBytes: 95, totalBytes: 100 }],
      }),
      NOW,
    );
    expect(wins.map((win) => win.id)).toEqual([
      "memory-speed",
      "gpu-driver-GPU",
      "space-C:",
      "uptime",
    ]);
  });

  it("stays empty for a tuned machine", () => {
    expect(quickWins(inventory(), sample(), NOW)).toEqual([]);
  });
});

describe("parseDriverDate", () => {
  it("reads the Windows /Date(ms)/ form and ISO dates", () => {
    expect(parseDriverDate("/Date(1734048000000)/")).toBe(1734048000000);
    expect(parseDriverDate("2025-01-01")).toBe(Date.parse("2025-01-01"));
    expect(parseDriverDate(null)).toBeNull();
  });
});

describe("plain time words", () => {
  it("reads uptime and drive age", () => {
    expect(uptimeText(NOW - 30 * 60_000, NOW)).toBe("30 min");
    expect(uptimeText(NOW - 3 * DAY, NOW)).toBe("3 days");
    expect(ageText(24 * 400)).toBe("1.1 years of use");
    expect(ageText(null)).toBeNull();
  });
});

describe("speedReached", () => {
  it("uses the sticks' rating before a Tune run and expected.json after it", () => {
    const inv = inventory({
      memory: {
        totalBytes: 32,
        modules: [
          {
            slot: "A",
            capacityBytes: 16,
            speedMts: 6000,
            configuredSpeedMts: 4800,
            manufacturer: null,
            partNumber: null,
          },
        ],
      },
    });
    const before = speedReached(inv, null, 4600, 2500);
    expect(before.rows.map((row) => row.pct)).toEqual([null, 80, null]);
    expect(before.overall).toBe(80);
    const after = speedReached(
      inv,
      { cpuMaxBoostMhz: 5000, memoryRatedMts: 6000, gpuBoostClockMhz: 2475, source: null },
      4600,
      2900,
    );
    expect(after.rows.map((row) => row.pct)).toEqual([92, 80, 100]);
    expect(after.overall).toBe(91);
  });
});

describe("status quick wins and before/after", () => {
  it("flags a pending restart, power saver, many startup apps and old updates", () => {
    const status = {
      at: NOW,
      topApps: [],
      powerPlan: "Power saver",
      startupApps: Array.from({ length: 13 }, (_, i) => `app${i}`),
      updates: { rebootPending: true, lastInstalledOn: "2026-01-01" },
      battery: null,
      network: [],
      bottlenecks: [],
      benchmarks: [],
      expected: null,
    };
    expect(quickWins(null, null, NOW, status).map((win) => win.id)).toEqual([
      "power-plan",
      "reboot",
      "startup",
      "updates",
    ]);
  });

  it("pairs the newest before-run with the next after-run", () => {
    const run = (label: string, at: string) => ({
      at,
      label,
      cpuSingleScore: 1,
      cpuMultiScore: 1,
      memoryCopyGBs: 1,
      diskWriteMBs: 1,
      lastBootMs: null,
    });
    expect(beforeAfter([run("before", "1"), run("after", "2"), run("before", "3")])).toBeNull();
    expect(
      beforeAfter([run("before", "1"), run("checkup", "2"), run("after", "3")])?.after.at,
    ).toBe("3");
  });
});
