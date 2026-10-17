import { describe, expect, it } from "vite-plus/test";

import { downsample, parsePoints } from "./history.ts";
import {
  parseDeepSensors,
  parseDriveTemps,
  parseNvidiaSmiLine,
  parseTypeperfRow,
  parseWindowsInventory,
  parseWindowsVolumes,
  type HostBasics,
  wmiDate,
} from "./parsers.ts";
import { auditPrompt } from "./promptAudit.ts";
import { BENCHMARK_SCRIPT, buildAgentPrompt, machineSummary } from "./SystemCare.ts";

const host: HostBasics = {
  platform: "win32",
  hostname: "DESKTOP",
  architecture: "x64",
  osRelease: "10.0.26200",
  cpuModel: "fallback cpu",
  threads: 24,
  totalMemoryBytes: 64 * 1024 ** 3,
  bootedAt: null,
};

// Captured from a real Windows 11 machine (trimmed).
const inventoryJson = JSON.stringify({
  cpu: {
    Name: "12th Gen Intel(R) Core(TM) i9-12900KF",
    Manufacturer: "GenuineIntel",
    NumberOfCores: 16,
    NumberOfLogicalProcessors: 24,
    MaxClockSpeed: 3200,
    L2CacheSize: 14336,
    L3CacheSize: 30720,
    SocketDesignation: "U3E1",
    VirtualizationFirmwareEnabled: false,
  },
  gpu: [
    {
      Name: "Virtual Display Driver",
      AdapterCompatibility: "MikeTheTech",
      DriverVersion: "11.30.4.434",
      DriverDate: "2024-12-23T17:00:00-07:00",
      AdapterRAM: null,
    },
    {
      Name: "NVIDIA GeForce RTX 4070",
      AdapterCompatibility: "NVIDIA",
      DriverVersion: "32.0.16.1742",
      DriverDate: "2026-09-29T17:00:00-07:00",
      AdapterRAM: 4293918720,
    },
  ],
  mem: [
    {
      Capacity: 17179869184,
      Speed: 5200,
      ConfiguredClockSpeed: 5200,
      Manufacturer: "Corsair",
      PartNumber: "CMK32GX5M2B5600C36  ",
      DeviceLocator: "Controller0-ChannelA-DIMM0",
    },
  ],
  disk: [
    {
      DeviceId: "1",
      FriendlyName: "WDC WD10EZEX-60WN4A0",
      Size: 1000204886016,
      MediaType: 3,
      BusType: 11,
      HealthStatus: 0,
      FirmwareVersion: "01.01A01",
    },
    {
      DeviceId: "0",
      FriendlyName: "WD_BLACK SN750 SE 1TB",
      Size: 1000204886016,
      MediaType: 4,
      BusType: 17,
      HealthStatus: 1,
      FirmwareVersion: "711250WD",
    },
  ],
  rel: [
    { DeviceId: "0", Wear: 0, PowerOnHours: null },
    { DeviceId: "1", Wear: 0, PowerOnHours: 39041 },
  ],
  board: { Manufacturer: "EVGA Corp.", Product: "Z690 CLASSIFIED" },
  bios: { SMBIOSBIOSVersion: "2.12", ReleaseDate: "2023-03-28T17:00:00-07:00" },
  os: {
    Caption: "Microsoft Windows 11 Pro",
    Version: "10.0.26200",
    OSArchitecture: "64-bit",
    LastBootUpTime: "2026-10-11T19:07:06.5-07:00",
  },
  vol: [
    { DeviceID: "C:", VolumeName: "" },
    { DeviceID: "D:", VolumeName: "HQ" },
  ],
});

describe("parseWindowsInventory", () => {
  it("maps CIM output into the inventory", () => {
    const inventory = parseWindowsInventory(inventoryJson, host, 1);
    expect(inventory.cpu).toMatchObject({
      name: "12th Gen Intel(R) Core(TM) i9-12900KF",
      cores: 16,
      threads: 24,
      baseClockMhz: 3200,
    });
    expect(inventory.gpus.map((gpu) => gpu.name)).toEqual([
      "Virtual Display Driver",
      "NVIDIA GeForce RTX 4070",
    ]);
    expect(inventory.memory.modules[0]).toMatchObject({
      partNumber: "CMK32GX5M2B5600C36",
      configuredSpeedMts: 5200,
    });
    expect(inventory.disks).toEqual([
      expect.objectContaining({
        id: "1",
        mediaType: "hdd",
        busType: "SATA",
        health: "healthy",
        powerOnHours: 39041,
        wearPct: null,
      }),
      expect.objectContaining({ id: "0", mediaType: "ssd", busType: "NVMe", health: "warning" }),
    ]);
    expect(inventory.board).toEqual({
      manufacturer: "EVGA Corp.",
      product: "Z690 CLASSIFIED",
      biosVersion: "2.12",
      biosDate: "2023-03-28",
    });
    expect(inventory.os.name).toBe("Microsoft Windows 11 Pro");
  });

  it("falls back to Node's view when PowerShell returns nothing", () => {
    expect(parseWindowsInventory("", host, 1).cpu.name).toBe("fallback cpu");
  });

  it("lists fixed volumes", () => {
    expect(parseWindowsVolumes(inventoryJson)).toEqual([
      { mount: "C:", label: null, mediaType: "unknown" },
      { mount: "D:", label: "HQ", mediaType: "unknown" },
    ]);
  });
});

describe("probe parsers", () => {
  it("reads an nvidia-smi row and derives the slowdown temperature from driver headroom", () => {
    const gpu = parseNvidiaSmiLine(
      "0, NVIDIA GeForce RTX 4070, 6, 5, 2583, 12282, 43, 2820, 10501, 54.29, 200.00, 30, 0x0000000000000400, 41",
    );
    expect(gpu).toMatchObject({
      index: 0,
      loadPct: 6,
      tempC: 43,
      slowdownTempC: 84,
      powerW: 54.29,
      vramTotalBytes: 12282 * 1024 * 1024,
      thermalThrottling: false,
    });
  });

  it("treats unsupported nvidia-smi fields as unknown and decodes thermal throttling", () => {
    const gpu = parseNvidiaSmiLine(
      "1, Laptop GPU, 99, 40, 100, 4096, 88, 1500, 6000, [N/A], [N/A], [Not Supported], 0x0000000000000040, [N/A]",
    );
    expect(gpu).toMatchObject({
      powerW: null,
      fanPct: null,
      slowdownTempC: null,
      thermalThrottling: true,
    });
  });

  it("reads typeperf data rows and skips the header", () => {
    expect(parseTypeperfRow('"(PDH-CSV 4.0)","\\\\PC\\Processor"')).toBeNull();
    expect(
      parseTypeperfRow(
        '"10/13/2026 23:48:32.338","144.010373","3401525.96","33023808.66","40.746591"',
      ),
    ).toEqual({
      performancePct: 144.010373,
      readBytesPerSec: 3401525.96,
      writeBytesPerSec: 33023808.66,
      activePct: 100 - 40.746591,
    });
  });

  it("drops drives that report no temperature", () => {
    expect(
      parseDriveTemps('[{"DeviceId":"0","Temperature":0},{"DeviceId":"2","Temperature":38}]'),
    ).toEqual([{ diskId: "2", tempC: 38 }]);
  });

  it("reads LibreHardwareMonitor output, including TjMax from core distance", () => {
    const raw = `﻿${JSON.stringify({
      writtenAt: 5,
      sensors: [
        {
          id: "/intelcpu/0/temperature/0",
          hardware: "i9",
          type: "Temperature",
          name: "P-Core #1",
          value: 61,
        },
        {
          id: "/intelcpu/0/temperature/20",
          hardware: "i9",
          type: "Temperature",
          name: "P-Core #1 Distance to TjMax",
          value: 39,
        },
        {
          id: "/intelcpu/0/temperature/16",
          hardware: "i9",
          type: "Temperature",
          name: "CPU Package",
          value: 64,
        },
        {
          id: "/intelcpu/0/temperature/17",
          hardware: "i9",
          type: "Temperature",
          name: "Core Max",
          value: 66,
        },
        {
          id: "/intelcpu/0/power/0",
          hardware: "i9",
          type: "Power",
          name: "CPU Package",
          value: 88.4,
        },
        {
          id: "/gpu-nvidia/0/temperature/2",
          hardware: "NVIDIA GeForce RTX 4070",
          type: "Temperature",
          name: "GPU Hot Spot",
          value: 49.8125,
        },
        { id: "/lpc/nct6798d/fan/1", hardware: "Nuvoton", type: "Fan", name: "Fan #2", value: 812 },
      ],
    })}`;
    const deep = parseDeepSensors(raw);
    expect(deep).toMatchObject({
      cpuPackageTempC: 64,
      cpuMaxCoreTempC: 66,
      cpuTjMaxC: 100,
      cpuPowerW: 88.4,
    });
    expect(deep?.gpuHotspotC).toEqual([{ hardware: "NVIDIA GeForce RTX 4070", tempC: 49.81 }]);
    expect(deep?.sensors.find((sensor) => sensor.kind === "Fan")?.unit).toBe("RPM");
    expect(parseDeepSensors("not json")).toBeNull();
  });
});

describe("history files", () => {
  it("skips a torn last line and downsamples into buckets", () => {
    const points = parsePoints(
      `${JSON.stringify({ at: 0, avg: { a: 1 }, max: { a: 1 } })}\n${JSON.stringify({ at: 5, avg: { a: 3 }, max: { a: 4 } })}\n{"at":10,"av`,
    );
    expect(points).toHaveLength(2);
    expect(downsample(points, 10)).toEqual([{ at: 0, avg: { a: 2 }, max: { a: 4 } }]);
  });
});

describe("wmiDate", () => {
  it("turns the Windows /Date(ms)/ form and ISO text into a day", () => {
    expect(wmiDate("/Date(1734048000000)/")).toBe("2024-12-13");
    expect(wmiDate("2025-03-01T00:00:00")).toBe("2025-03-01");
    expect(wmiDate(null)).toBeNull();
  });
});

describe("PC Tuning prompts", () => {
  it("summarizes the machine and points the agent at its evidence", () => {
    const inventory = parseWindowsInventory(inventoryJson, host, 1);
    expect(machineSummary(inventory)).toContain(
      "**GPU:** NVIDIA GeForce RTX 4070, driver 32.0.16.1742",
    );
    const prompt = buildAgentPrompt(
      "checkup",
      {
        inventory,
        sample: null,
        limits: [],
        alerts: [],
        alert: null,
        history: { range: "24h", resolutionMs: 1, points: [] },
        historyDir: "/state/hardware/history",
      },
      "incidents/x.json",
    );
    expect(prompt).toContain("wait for my yes");
    expect(prompt).toContain("incidents/x.json");
  });

  it("keeps every generated prompt at full marks on the prompt-composer rubric", () => {
    const inventory = parseWindowsInventory(inventoryJson, host, 1);
    const base = {
      inventory,
      sample: null,
      limits: [],
      alerts: [],
      history: { range: "24h" as const, resolutionMs: 1, points: [] },
      historyDir: "/state/hardware/history",
    };
    const alert = (metric: string) => ({
      id: "a1",
      metric,
      label: "Drive F: space used",
      severity: "warning" as const,
      unit: "%",
      value: 91,
      peak: 92,
      limit: 90,
      message: "Drive F: space used is 91%.",
      startedAt: 0,
      lastSeenAt: 0,
      resolvedAt: null,
      acknowledged: false,
      threadId: null,
    });
    const prompts = [
      buildAgentPrompt("checkup", { ...base, alert: null }, "incidents/x.json"),
      ...["cpu.temp", "gpu.0.temp", "memory.load", "volume.F:.used", "drive.0.temp", "other"].map(
        (metric) =>
          buildAgentPrompt("investigate", { ...base, alert: alert(metric) }, "incidents/x.json"),
      ),
    ];
    for (const prompt of prompts) {
      expect(auditPrompt(prompt)).toEqual({ score: 100, failures: [] });
    }
    expect(auditPrompt("Be thorough and fix the PC.").score).toBeLessThan(60);
  });

  it("makes the tune prompt measure, research, save and measure again", () => {
    const inventory = parseWindowsInventory(inventoryJson, host, 1);
    const context = {
      inventory,
      sample: null,
      limits: [],
      alerts: [],
      alert: null,
      history: { range: "24h" as const, resolutionMs: 1, points: [] },
      historyDir: "/state/hardware/history",
    };
    const prompt = buildAgentPrompt("tune", context, "incidents/x.json", "/aios/domains/pc/pc.md");
    expect(auditPrompt(prompt, "tune")).toEqual({ score: 100, failures: [] });
    expect(prompt).toContain("Save: write /aios/domains/pc/pc.md");
    expect(prompt).toContain("- No file, setting or process was modified before my yes.");
    const checkup = buildAgentPrompt("checkup", context, "incidents/x.json");
    expect(auditPrompt(checkup, "tune").failures).toContain("benchmarks again after the fixes");
  });

  it("keeps the benchmark script plain ASCII with one JSON line out", () => {
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(BENCHMARK_SCRIPT)).toBe(true);
    expect(BENCHMARK_SCRIPT).toContain(
      'Add-Content -Path (Join-Path $PSScriptRoot "benchmarks.jsonl")',
    );
  });
});
