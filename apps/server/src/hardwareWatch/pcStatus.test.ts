import type { HardwareSample } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  fullResources,
  networkRates,
  parseBenchmarks,
  parseExpected,
  parseProbeFrame,
  summarizeBottlenecks,
  topApps,
} from "./pcStatus.ts";

const MIN = 60_000;

describe("parseProbeFrame", () => {
  it("reads processes, adapters and the slow facts", () => {
    const frame = parseProbeFrame(
      [
        "P|chrome|120.50|2000000000|30",
        "P|odd|name|1.00|10|1",
        "P|broken|x|y|z",
        "N|Ethernet 2|1000|5000|700",
        'S|{"plan":"Balanced","startup":["Steam","Steam",""],"reboot":true,"lastUpdate":"2026-08-04","battery":{"pct":80,"status":2}}',
      ],
      1000,
    );
    expect(frame.processes.map((entry) => entry.name)).toEqual(["chrome", "odd|name"]);
    expect(frame.net[0]).toEqual({
      name: "Ethernet 2",
      linkMbps: 1000,
      receivedBytes: 5000,
      sentBytes: 700,
    });
    expect(frame.slow).toEqual({
      powerPlan: "Balanced",
      startupApps: ["Steam"],
      rebootPending: true,
      lastInstalledOn: "2026-08-04",
      battery: { chargePct: 80, charging: true },
    });
  });
});

describe("rates between frames", () => {
  const first = parseProbeFrame(["P|game|100|10|1", "P|Idle|0|0|1", "N|Wi-Fi|300|1000|500"], 0);
  const second = parseProbeFrame(
    ["P|game|160|10|1", "P|Idle|999|0|1", "N|Wi-Fi|300|7000|1100"],
    MIN,
  );

  it("turns CPU seconds into a share of the whole machine and drops Idle", () => {
    const apps = topApps(first, second, 4);
    expect(apps).toEqual([{ name: "game", cpuPct: 25, memoryBytes: 10, processes: 1 }]);
    expect(topApps(null, second, 4)[0]!.cpuPct).toBe(0);
  });

  it("turns byte counters into bytes per second", () => {
    expect(networkRates(first, second)[0]).toMatchObject({
      receiveBytesPerSec: 100,
      sendBytesPerSec: 10,
    });
    expect(networkRates(null, second)[0]!.receiveBytesPerSec).toBeNull();
  });
});

describe("bottleneck detective", () => {
  const sample = (overrides: Partial<HardwareSample>): HardwareSample => ({
    at: 0,
    cpu: {
      loadPct: 20,
      coreLoadPct: [10],
      clockMhz: null,
      packageTempC: null,
      maxCoreTempC: null,
      tjMaxC: null,
      powerW: null,
    },
    memory: { usedBytes: 1, totalBytes: 10 },
    gpus: [],
    disk: { readBytesPerSec: null, writeBytesPerSec: null, activePct: 5 },
    volumes: [],
    driveTemps: [],
    sensors: [],
    ...overrides,
  });

  it("names one busy thread apart from a busy processor", () => {
    expect(
      fullResources(sample({ cpu: { ...sample({}).cpu, loadPct: 30, coreLoadPct: [100, 5] } })),
    ).toEqual(["one processor thread"]);
    expect(
      fullResources(
        sample({
          cpu: { ...sample({}).cpu, loadPct: 95 },
          memory: { usedBytes: 95, totalBytes: 100 },
        }),
      ),
    ).toEqual(["processor", "memory"]);
  });

  it("reports the part that fills first per app, and needs enough minutes", () => {
    const now = 10 * MIN;
    const records = [
      ...Array.from({ length: 6 }, (_, i) => ({
        at: i * MIN,
        app: "Premiere",
        full: i < 4 ? ["memory"] : [],
      })),
      ...Array.from({ length: 2 }, (_, i) => ({ at: i * MIN, app: "Brief", full: ["disk"] })),
      { at: now - 8 * 24 * 60 * MIN, app: "Old", full: ["disk"] },
    ];
    expect(summarizeBottlenecks(records, now)).toEqual([
      { app: "Premiere", resource: "memory", fullMinutes: 4, activeMinutes: 6 },
    ]);
  });
});

describe("benchmarks and expected speeds", () => {
  it("keeps good benchmark lines and skips broken ones", () => {
    const runs = parseBenchmarks(
      '{"at":"2026-10-15T10:00:00","label":"before","cpuSingleScore":40,"lastBootMs":"x"}\n{"at":\n',
    );
    expect(runs).toEqual([
      {
        at: "2026-10-15T10:00:00",
        label: "before",
        cpuSingleScore: 40,
        cpuMultiScore: null,
        memoryCopyGBs: null,
        diskWriteMBs: null,
        lastBootMs: null,
      },
    ]);
  });

  it("needs at least one rated speed", () => {
    expect(parseExpected('{"cpuMaxBoostMhz":5200,"source":"intel.com"}')).toMatchObject({
      cpuMaxBoostMhz: 5200,
    });
    expect(parseExpected("{}")).toBeNull();
    expect(parseExpected("not json")).toBeNull();
  });
});
