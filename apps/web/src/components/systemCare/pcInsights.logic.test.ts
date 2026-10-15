import type { HardwareInventory, HardwareLimit, HardwareSample } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { ageText, healthScore, parseDriverDate, quickWins, uptimeText } from "./pcInsights.logic";

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
  volumes: [{ mount: "C:", label: null, usedBytes: 50, totalBytes: 100 }],
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
      sample({ volumes: [{ mount: "C:", label: null, usedBytes: 95, totalBytes: 100 }] }),
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
