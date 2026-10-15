/**
 * Pure helpers behind the PC Tuning status: the long-lived PowerShell probe, its parser, per-app
 * CPU and network rates, and the bottleneck detective. The probe stays open and prints one frame a
 * minute, because a new PowerShell costs about 1.5 s of CPU to start and a loop pass costs almost 0.
 */
import type { HardwarePcStatus, HardwareSample } from "@t3tools/contracts";

export const PROBE_EVERY_SECONDS = 60;
/** Power plan, startup, updates and battery change slowly: read them every 10th frame. */
export const SLOW_EVERY_FRAMES = 10;

export const PC_PROBE_SCRIPT = `$ErrorActionPreference = 'SilentlyContinue'
$z = 0
while ($true) {
  $t = @{}
  foreach ($x in [System.Diagnostics.Process]::GetProcesses()) {
    $c = 0; try { $c = $x.TotalProcessorTime.TotalSeconds } catch {}
    $e = $t[$x.ProcessName]
    if ($e) { $e[0] += $c; $e[1] += $x.WorkingSet64; $e[2] += 1 } else { $t[$x.ProcessName] = @($c, $x.WorkingSet64, 1) }
  }
  foreach ($k in $t.Keys) { 'P|{0}|{1:F2}|{2}|{3}' -f $k, $t[$k][0], $t[$k][1], $t[$k][2] }
  foreach ($i in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($i.OperationalStatus -eq 'Up' -and $i.NetworkInterfaceType -ne 'Loopback' -and $i.NetworkInterfaceType -ne 'Tunnel' -and $i.Name -notlike 'vEthernet*') {
      $s = $i.GetIPStatistics(); 'N|{0}|{1}|{2}|{3}' -f $i.Name, [math]::Round($i.Speed / 1e6), $s.BytesReceived, $s.BytesSent
    }
  }
  if ($z % ${SLOW_EVERY_FRAMES} -eq 0) {
    $plan = $null
    $line = powercfg /getactivescheme
    if ($line -match '\\((.+)\\)') { $plan = $Matches[1] }
    $startup = @(Get-CimInstance Win32_StartupCommand | Select-Object -ExpandProperty Name | Where-Object { $_ })
    $reboot = (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') -or (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending')
    $hf = Get-HotFix | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
    $bat = Get-CimInstance Win32_Battery | Select-Object -First 1
    'S|' + ([pscustomobject]@{
      plan = $plan
      startup = $startup
      reboot = [bool]$reboot
      lastUpdate = $(if ($hf) { $hf.InstalledOn.ToString('yyyy-MM-dd') } else { $null })
      battery = $(if ($bat) { @{ pct = $bat.EstimatedChargeRemaining; status = $bat.BatteryStatus } } else { $null })
    } | ConvertTo-Json -Compress -Depth 4)
  }
  'END'
  $z++
  Start-Sleep -Seconds ${PROBE_EVERY_SECONDS}
}
`;

export interface ProcessTotals {
  readonly name: string;
  readonly cpuSeconds: number;
  readonly memoryBytes: number;
  readonly processes: number;
}

export interface NetTotals {
  readonly name: string;
  readonly linkMbps: number | null;
  readonly receivedBytes: number;
  readonly sentBytes: number;
}

export interface SlowFacts {
  readonly powerPlan: string | null;
  readonly startupApps: ReadonlyArray<string>;
  readonly rebootPending: boolean;
  readonly lastInstalledOn: string | null;
  readonly battery: HardwarePcStatus["battery"];
}

export interface ProbeFrame {
  readonly at: number;
  readonly processes: ReadonlyArray<ProcessTotals>;
  readonly net: ReadonlyArray<NetTotals>;
  readonly slow: SlowFacts | null;
}

const num = (text: string | undefined) => {
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

function parseSlow(json: string): SlowFacts | null {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const battery = raw.battery as { pct?: unknown; status?: unknown } | null | undefined;
    const startup = Array.isArray(raw.startup) ? raw.startup : raw.startup ? [raw.startup] : [];
    return {
      powerPlan: typeof raw.plan === "string" ? raw.plan : null,
      startupApps: [
        ...new Set(
          startup.filter((name): name is string => typeof name === "string" && name.trim() !== ""),
        ),
      ],
      rebootPending: raw.reboot === true,
      lastInstalledOn: typeof raw.lastUpdate === "string" ? raw.lastUpdate : null,
      battery:
        battery && typeof battery.pct === "number"
          ? // Win32_Battery status 2 means it runs on mains power.
            { chargePct: battery.pct, charging: battery.status === 2 }
          : null,
    };
  } catch {
    return null;
  }
}

/** Reads the lines of one probe frame (everything before an `END` line). */
export function parseProbeFrame(lines: ReadonlyArray<string>, at: number): ProbeFrame {
  const processes: ProcessTotals[] = [];
  const net: NetTotals[] = [];
  let slow: SlowFacts | null = null;
  for (const line of lines) {
    if (line.startsWith("S|")) {
      slow = parseSlow(line.slice(2));
      continue;
    }
    // Process and adapter names can hold "|", so read the numbers from the right.
    const parts = line.split("|");
    if (parts[0] === "P" && parts.length >= 5) {
      const [cpu, memory, count] = parts.slice(-3).map(num);
      if (cpu === null || memory === null || count === null) continue;
      processes.push({
        name: parts.slice(1, -3).join("|"),
        cpuSeconds: cpu ?? 0,
        memoryBytes: memory ?? 0,
        processes: count ?? 0,
      });
    } else if (parts[0] === "N" && parts.length >= 5) {
      const [link, received, sent] = parts.slice(-3).map(num);
      if (received === null || sent === null) continue;
      net.push({
        name: parts.slice(1, -3).join("|"),
        linkMbps: link ?? null,
        receivedBytes: received ?? 0,
        sentBytes: sent ?? 0,
      });
    }
  }
  return { at, processes, net, slow };
}

/** Windows bookkeeping that is never the app a person cares about. */
const NOT_AN_APP = new Set(["idle", "system", "registry", "memory compression", "secure system"]);

/** Share of the whole machine each app used between two frames, highest first. */
export function topApps(
  previous: ProbeFrame | null,
  current: ProbeFrame,
  threads: number,
  limit = 10,
): HardwarePcStatus["topApps"] {
  const before = new Map(previous?.processes.map((entry) => [entry.name, entry.cpuSeconds]));
  const seconds = previous ? Math.max(1, (current.at - previous.at) / 1000) : null;
  return current.processes
    .filter((entry) => !NOT_AN_APP.has(entry.name.toLowerCase()))
    .map((entry) => {
      const prior = before.get(entry.name);
      const used =
        seconds !== null && prior !== undefined ? Math.max(0, entry.cpuSeconds - prior) : 0;
      return {
        name: entry.name,
        cpuPct:
          seconds === null ? 0 : Math.round((used / seconds / Math.max(1, threads)) * 1000) / 10,
        memoryBytes: entry.memoryBytes,
        processes: entry.processes,
      };
    })
    .toSorted((a, b) => b.cpuPct - a.cpuPct || b.memoryBytes - a.memoryBytes)
    .slice(0, limit);
}

export function networkRates(
  previous: ProbeFrame | null,
  current: ProbeFrame,
): HardwarePcStatus["network"] {
  const before = new Map(previous?.net.map((entry) => [entry.name, entry]));
  const seconds = previous ? Math.max(1, (current.at - previous.at) / 1000) : null;
  return current.net.map((entry) => {
    const prior = before.get(entry.name);
    const rate = (now: number, then: number | undefined) =>
      seconds === null || then === undefined || now < then ? null : (now - then) / seconds;
    return {
      name: entry.name,
      linkMbps: entry.linkMbps,
      receiveBytesPerSec: rate(entry.receivedBytes, prior?.receivedBytes),
      sendBytesPerSec: rate(entry.sentBytes, prior?.sentBytes),
    };
  });
}

/** The parts that were full in a sample, in plain words. */
export function fullResources(sample: HardwareSample): string[] {
  const full: string[] = [];
  const load = sample.cpu.loadPct;
  const hottestThread = Math.max(0, ...sample.cpu.coreLoadPct);
  if (load !== null && load >= 90) full.push("processor");
  else if (hottestThread >= 95 && (load === null || load < 60)) full.push("one processor thread");
  if ((sample.memory.usedBytes / Math.max(1, sample.memory.totalBytes)) * 100 >= 90)
    full.push("memory");
  for (const gpu of sample.gpus) {
    if (gpu.loadPct !== null && gpu.loadPct >= 95) full.push("graphics");
    if (
      gpu.vramUsedBytes !== null &&
      gpu.vramTotalBytes &&
      gpu.vramUsedBytes / gpu.vramTotalBytes >= 0.95
    )
      full.push("video memory");
  }
  if (sample.disk.activePct !== null && sample.disk.activePct >= 90) full.push("disk");
  return [...new Set(full)];
}

export interface MinuteRecord {
  readonly at: number;
  readonly app: string;
  readonly full: ReadonlyArray<string>;
}

export const BOTTLENECK_WINDOW_MS = 7 * 24 * 60 * 60_000;
/** An app needs this much busy time before the page names its bottleneck. */
const MIN_ACTIVE_MINUTES = 5;
const MIN_FULL_MINUTES = 3;

/** For each app, the part that was full most often while that app was the busiest one. */
export function summarizeBottlenecks(
  records: ReadonlyArray<MinuteRecord>,
  now: number,
): HardwarePcStatus["bottlenecks"] {
  const byApp = new Map<string, { active: number; full: Map<string, number> }>();
  for (const record of records) {
    if (now - record.at > BOTTLENECK_WINDOW_MS) continue;
    const entry = byApp.get(record.app) ?? { active: 0, full: new Map<string, number>() };
    entry.active += 1;
    for (const resource of record.full)
      entry.full.set(resource, (entry.full.get(resource) ?? 0) + 1);
    byApp.set(record.app, entry);
  }
  const findings: Array<HardwarePcStatus["bottlenecks"][number]> = [];
  for (const [app, entry] of byApp) {
    if (entry.active < MIN_ACTIVE_MINUTES) continue;
    const [resource, count] =
      [...entry.full].toSorted((a, b) => b[1] - a[1])[0] ?? ([null, 0] as const);
    if (resource === null || count < MIN_FULL_MINUTES) continue;
    findings.push({ app, resource, fullMinutes: count, activeMinutes: entry.active });
  }
  return findings.toSorted((a, b) => b.fullMinutes - a.fullMinutes).slice(0, 6);
}

const nullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** The last 20 runs of benchmark.ps1; bad lines are skipped. */
export function parseBenchmarks(text: string): HardwarePcStatus["benchmarks"] {
  const runs: Array<HardwarePcStatus["benchmarks"][number]> = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      if (typeof raw.at !== "string") continue;
      runs.push({
        at: raw.at,
        label: typeof raw.label === "string" ? raw.label : "manual",
        cpuSingleScore: nullableNumber(raw.cpuSingleScore),
        cpuMultiScore: nullableNumber(raw.cpuMultiScore),
        memoryCopyGBs: nullableNumber(raw.memoryCopyGBs),
        diskWriteMBs: nullableNumber(raw.diskWriteMBs),
        lastBootMs: nullableNumber(raw.lastBootMs),
      });
    } catch {
      // A half-written line from a run in progress.
    }
  }
  return runs.slice(-20);
}

/** `expected.json`, written by a Tune agent from the makers' rated speeds. */
export function parseExpected(text: string | null): HardwarePcStatus["expected"] {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const expected = {
      cpuMaxBoostMhz: nullableNumber(raw.cpuMaxBoostMhz),
      memoryRatedMts: nullableNumber(raw.memoryRatedMts),
      gpuBoostClockMhz: nullableNumber(raw.gpuBoostClockMhz),
      source: typeof raw.source === "string" ? raw.source : null,
    };
    return (expected.cpuMaxBoostMhz ?? expected.memoryRatedMts ?? expected.gpuBoostClockMhz)
      ? expected
      : null;
  } catch {
    return null;
  }
}
