import type {
  HardwareGpuSample,
  HardwareInventory,
  HardwareSensorReading,
} from "@t3tools/contracts";

/**
 * One CIM pass over the machine. It takes a few seconds, so it runs once per server start and on
 * an explicit refresh, never on the sampling path.
 */
export const WINDOWS_INVENTORY_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,L2CacheSize,L3CacheSize,SocketDesignation,VirtualizationFirmwareEnabled
$gpu = @(Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,DriverVersion,DriverDate,AdapterRAM)
$mem = @(Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,Speed,ConfiguredClockSpeed,Manufacturer,PartNumber,DeviceLocator)
$disk = @(Get-CimInstance -Namespace root/Microsoft/Windows/Storage MSFT_PhysicalDisk | Select-Object DeviceId,FriendlyName,Size,MediaType,BusType,HealthStatus,FirmwareVersion)
$rel = @(Get-PhysicalDisk | Get-StorageReliabilityCounter | Select-Object DeviceId,Wear,PowerOnHours)
$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1 Manufacturer,Product
$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1 SMBIOSBIOSVersion,ReleaseDate
$os = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption,Version,OSArchitecture,LastBootUpTime
$vol = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,VolumeName)
[pscustomobject]@{ cpu = $cpu; gpu = $gpu; mem = $mem; disk = $disk; rel = $rel; board = $board; bios = $bios; os = $os; vol = $vol } | ConvertTo-Json -Depth 4 -Compress
`;

export interface VolumeRef {
  readonly mount: string;
  readonly label: string | null;
}

/** Fixed local drives from the inventory pass; space is sampled live with statfs. */
export function parseWindowsVolumes(raw: string): VolumeRef[] {
  try {
    return asArray((JSON.parse(raw) as Json).vol).flatMap((row) => {
      const mount = str(row.DeviceID);
      return mount ? [{ mount, label: str(row.VolumeName) }] : [];
    });
  } catch {
    return [];
  }
}

/** Drive temperatures change slowly; this runs every few minutes. */
export const WINDOWS_DRIVE_TEMPS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
@(Get-PhysicalDisk | Get-StorageReliabilityCounter | Select-Object DeviceId,Temperature) | ConvertTo-Json -Compress
`;

type Json = Record<string, unknown>;
const asArray = (value: unknown): Json[] =>
  Array.isArray(value)
    ? (value as Json[])
    : value && typeof value === "object"
      ? [value as Json]
      : [];
const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : null;
const dateMs = (value: unknown): number | null => {
  const text = str(value);
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
};

const MEDIA_TYPES: Record<number, "ssd" | "hdd"> = { 3: "hdd", 4: "ssd" };
const BUS_TYPES: Record<number, string> = {
  1: "SCSI",
  3: "ATA",
  6: "Fibre Channel",
  7: "USB",
  8: "RAID",
  10: "SAS",
  11: "SATA",
  12: "SD",
  13: "MMC",
  17: "NVMe",
};
const HEALTH: Record<number, "healthy" | "warning" | "unhealthy"> = {
  0: "healthy",
  1: "warning",
  2: "unhealthy",
};

export interface HostBasics {
  readonly platform: string;
  readonly hostname: string;
  readonly architecture: string;
  readonly osRelease: string;
  readonly cpuModel: string;
  readonly threads: number;
  readonly totalMemoryBytes: number;
  readonly bootedAt: number | null;
}

/** Inventory from Node alone: the fallback when CIM is unavailable or the host is not Windows. */
export function basicInventory(host: HostBasics, collectedAt: number): HardwareInventory {
  return {
    collectedAt,
    platform: host.platform,
    os: {
      name: host.platform,
      version: host.osRelease,
      architecture: host.architecture,
      hostname: host.hostname,
      bootedAt: host.bootedAt,
    },
    cpu: {
      name: host.cpuModel,
      vendor: null,
      cores: null,
      threads: host.threads,
      baseClockMhz: null,
      l2CacheKb: null,
      l3CacheKb: null,
      socket: null,
      virtualizationEnabled: null,
    },
    gpus: [],
    memory: { totalBytes: host.totalMemoryBytes, modules: [] },
    disks: [],
    board: { manufacturer: null, product: null, biosVersion: null, biosDate: null },
  };
}

export function parseWindowsInventory(
  raw: string,
  host: HostBasics,
  collectedAt: number,
): HardwareInventory {
  const base = basicInventory(host, collectedAt);
  let data: Json;
  try {
    data = JSON.parse(raw) as Json;
  } catch {
    return base;
  }
  const cpu = asArray(data.cpu)[0] ?? {};
  const os = asArray(data.os)[0] ?? {};
  const board = asArray(data.board)[0] ?? {};
  const bios = asArray(data.bios)[0] ?? {};
  const reliability = new Map(asArray(data.rel).map((row) => [String(row.DeviceId), row]));
  return {
    ...base,
    os: {
      name: str(os.Caption) ?? base.os.name,
      version: str(os.Version) ?? base.os.version,
      architecture: str(os.OSArchitecture) ?? base.os.architecture,
      hostname: base.os.hostname,
      bootedAt: dateMs(os.LastBootUpTime) ?? base.os.bootedAt,
    },
    cpu: {
      name: str(cpu.Name) ?? base.cpu.name,
      vendor: str(cpu.Manufacturer),
      cores: num(cpu.NumberOfCores),
      threads: num(cpu.NumberOfLogicalProcessors) ?? base.cpu.threads,
      baseClockMhz: num(cpu.MaxClockSpeed),
      l2CacheKb: num(cpu.L2CacheSize),
      l3CacheKb: num(cpu.L3CacheSize),
      socket: str(cpu.SocketDesignation),
      virtualizationEnabled:
        typeof cpu.VirtualizationFirmwareEnabled === "boolean"
          ? cpu.VirtualizationFirmwareEnabled
          : null,
    },
    gpus: asArray(data.gpu).map((gpu) => ({
      name: str(gpu.Name) ?? "Unknown display adapter",
      vendor: str(gpu.AdapterCompatibility),
      driverVersion: str(gpu.DriverVersion),
      driverDate: str(gpu.DriverDate)?.slice(0, 10) ?? null,
      // AdapterRAM is a 32-bit field and caps at 4 GiB; live samples carry the real total.
      vramBytes: num(gpu.AdapterRAM),
    })),
    memory: {
      totalBytes: base.memory.totalBytes,
      modules: asArray(data.mem).map((module) => ({
        slot: str(module.DeviceLocator),
        capacityBytes: num(module.Capacity) ?? 0,
        speedMts: num(module.Speed),
        configuredSpeedMts: num(module.ConfiguredClockSpeed),
        manufacturer: str(module.Manufacturer),
        partNumber: str(module.PartNumber),
      })),
    },
    disks: asArray(data.disk).map((disk) => {
      const id = String(disk.DeviceId ?? "");
      const counters = reliability.get(id) ?? {};
      return {
        id,
        model: str(disk.FriendlyName) ?? `Disk ${id}`,
        sizeBytes: num(disk.Size) ?? 0,
        mediaType: MEDIA_TYPES[num(disk.MediaType) ?? -1] ?? "unknown",
        busType: BUS_TYPES[num(disk.BusType) ?? -1] ?? null,
        health: HEALTH[num(disk.HealthStatus) ?? -1] ?? "unknown",
        firmware: str(disk.FirmwareVersion),
        powerOnHours: num(counters.PowerOnHours),
        // Drives without a wear counter report 0; that is unknown, not new.
        wearPct: num(counters.Wear) || null,
      };
    }),
    board: {
      manufacturer: str(board.Manufacturer),
      product: str(board.Product),
      biosVersion: str(bios.SMBIOSBIOSVersion),
      biosDate: str(bios.ReleaseDate)?.slice(0, 10) ?? null,
    },
  };
}

/** Drives that cannot report a temperature return 0; those are dropped rather than shown as cold. */
export function parseDriveTemps(raw: string): Array<{ diskId: string; tempC: number }> {
  try {
    return asArray(JSON.parse(raw))
      .map((row) => ({ diskId: String(row.DeviceId ?? ""), tempC: num(row.Temperature) ?? 0 }))
      .filter((row) => row.diskId !== "" && row.tempC > 0 && row.tempC < 120);
  } catch {
    return [];
  }
}

export const NVIDIA_SMI_FIELDS = [
  "index",
  "name",
  "utilization.gpu",
  "utilization.memory",
  "memory.used",
  "memory.total",
  "temperature.gpu",
  "clocks.gr",
  "clocks.mem",
  "power.draw",
  "power.limit",
  "fan.speed",
  "clocks_throttle_reasons.active",
  "temperature.gpu.tlimit",
] as const;

// NVML throttle reason bits.
const THROTTLE_SW_POWER = 0x4;
const THROTTLE_HW_SLOWDOWN = 0x8;
const THROTTLE_SW_THERMAL = 0x20;
const THROTTLE_HW_THERMAL = 0x40;
const THROTTLE_HW_POWER_BRAKE = 0x80;
const MIB = 1024 * 1024;

/** Parses one `--format=csv,noheader,nounits` row; "[N/A]" and "[Not Supported]" become null. */
export function parseNvidiaSmiLine(line: string): HardwareGpuSample | null {
  const cells = line.split(",").map((cell) => cell.trim());
  if (cells.length < NVIDIA_SMI_FIELDS.length) return null;
  const value = (index: number) => {
    const cell = cells[index]!;
    if (cell.startsWith("[") || cell === "N/A") return null;
    const parsed = Number(cell);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const gpuIndex = value(0);
  if (gpuIndex === null) return null;
  const tempC = value(6);
  const headroom = value(13);
  const reasons = cells[12]?.startsWith("0x") ? Number.parseInt(cells[12], 16) : 0;
  const usedMib = value(4);
  const totalMib = value(5);
  return {
    index: gpuIndex,
    name: cells[1] || `GPU ${gpuIndex}`,
    loadPct: value(2),
    memoryControllerPct: value(3),
    vramUsedBytes: usedMib === null ? null : usedMib * MIB,
    vramTotalBytes: totalMib === null ? null : totalMib * MIB,
    tempC,
    hotspotC: null,
    // The driver reports headroom ("T.Limit"): degrees left before it slows the GPU down.
    slowdownTempC: tempC !== null && headroom !== null ? tempC + headroom : null,
    coreClockMhz: value(7),
    memoryClockMhz: value(8),
    powerW: value(9),
    powerLimitW: value(10),
    fanPct: value(11),
    thermalThrottling:
      (reasons & (THROTTLE_SW_THERMAL | THROTTLE_HW_THERMAL | THROTTLE_HW_SLOWDOWN)) !== 0,
    powerThrottling: (reasons & (THROTTLE_SW_POWER | THROTTLE_HW_POWER_BRAKE)) !== 0,
  };
}

/** English counter paths; `typeperf` rejects them on localized Windows, and the fields stay null. */
export const TYPEPERF_COUNTERS = [
  String.raw`\Processor Information(_Total)\% Processor Performance`,
  String.raw`\PhysicalDisk(_Total)\Disk Read Bytes/sec`,
  String.raw`\PhysicalDisk(_Total)\Disk Write Bytes/sec`,
  String.raw`\PhysicalDisk(_Total)\% Idle Time`,
] as const;

export interface CounterReading {
  readonly performancePct: number | null;
  readonly readBytesPerSec: number | null;
  readonly writeBytesPerSec: number | null;
  readonly activePct: number | null;
}

/** Parses one PDH-CSV data row. The header row and status lines return null. */
export function parseTypeperfRow(line: string): CounterReading | null {
  if (!line.startsWith('"') || line.startsWith('"(PDH-CSV')) return null;
  const cells = line.split('","').map((cell) => cell.replaceAll('"', "").trim());
  if (cells.length < TYPEPERF_COUNTERS.length + 1) return null;
  const value = (index: number) => {
    const parsed = Number(cells[index]);
    return cells[index] === "" || !Number.isFinite(parsed) ? null : parsed;
  };
  const idle = value(4);
  return {
    performancePct: value(1),
    readBytesPerSec: value(2),
    writeBytesPerSec: value(3),
    activePct: idle === null ? null : Math.min(100, Math.max(0, 100 - idle)),
  };
}

export interface DeepSensorReadings {
  readonly writtenAt: number;
  readonly cpuPackageTempC: number | null;
  readonly cpuMaxCoreTempC: number | null;
  readonly cpuTjMaxC: number | null;
  readonly cpuPowerW: number | null;
  readonly gpuHotspotC: ReadonlyArray<{ readonly hardware: string; readonly tempC: number }>;
  readonly sensors: ReadonlyArray<HardwareSensorReading>;
}

const UNITS: Record<string, string> = {
  Temperature: "°C",
  Fan: "RPM",
  Voltage: "V",
  Power: "W",
  Clock: "MHz",
  Load: "%",
  Control: "%",
  Data: "GB",
  SmallData: "MB",
  Throughput: "B/s",
  Energy: "mWh",
  Current: "A",
  Frequency: "Hz",
  Level: "%",
  Factor: "",
  TimeSpan: "s",
};

/** Reads the Deep sensors file written by the elevated LibreHardwareMonitor script. */
export function parseDeepSensors(raw: string): DeepSensorReadings | null {
  let data: Json;
  try {
    data = JSON.parse(raw.replace(/^﻿/, "")) as Json;
  } catch {
    return null;
  }
  const writtenAt = num(data.writtenAt);
  if (writtenAt === null) return null;
  const sensors: HardwareSensorReading[] = asArray(data.sensors).flatMap((row) => {
    const value = num(row.value);
    const kind = str(row.type);
    if (value === null || kind === null) return [];
    return [
      {
        id: str(row.id) ?? `${row.hardware}/${row.name}`,
        hardware: str(row.hardware) ?? "Unknown",
        kind,
        name: str(row.name) ?? kind,
        value: Math.round(value * 100) / 100,
        unit: UNITS[kind] ?? "",
      },
    ];
  });
  const cpu = sensors.filter((sensor) => /^\/(intelcpu|amdcpu)\//.test(sensor.id));
  const cpuTemp = (pattern: RegExp) =>
    cpu.find((sensor) => sensor.kind === "Temperature" && pattern.test(sensor.name))?.value ?? null;
  const packageTempC = cpuTemp(/^(CPU Package|Core \(Tctl\/Tdie\)|Package)$/);
  const maxCoreTempC = cpuTemp(/^Core Max$/);
  // LHM reports "Distance to TjMax" per core; any core gives TjMax back from its own reading.
  const distance = cpu.find(
    (sensor) => sensor.kind === "Temperature" && sensor.name.endsWith("Distance to TjMax"),
  );
  const sameCore = distance
    ? cpu.find(
        (sensor) =>
          sensor.kind === "Temperature" &&
          sensor.name === distance.name.replace(" Distance to TjMax", ""),
      )
    : undefined;
  return {
    writtenAt,
    cpuPackageTempC: packageTempC,
    cpuMaxCoreTempC: maxCoreTempC,
    cpuTjMaxC: distance && sameCore ? Math.round(sameCore.value + distance.value) : null,
    cpuPowerW:
      cpu.find((sensor) => sensor.kind === "Power" && /^(CPU )?Package$/.test(sensor.name))
        ?.value ?? null,
    gpuHotspotC: sensors
      .filter((sensor) => sensor.kind === "Temperature" && sensor.name === "GPU Hot Spot")
      .map((sensor) => ({ hardware: sensor.hardware, tempC: sensor.value })),
    sensors,
  };
}
