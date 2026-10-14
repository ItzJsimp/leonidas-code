import type {
  HardwareAlert,
  HardwareAlertSeverity,
  HardwareHistoryPoint,
  HardwareInventory,
  HardwareLimit,
  HardwareSample,
} from "@t3tools/contracts";

/** Flat metric values keyed like `cpu.temp` or `gpu.0.power`; the unit of history, limits and alerts. */
export type HardwareMetrics = Record<string, number>;

const pct = (used: number, total: number) => (total > 0 ? (used / total) * 100 : 0);

function put(metrics: HardwareMetrics, key: string, value: number | null | undefined) {
  if (value !== null && value !== undefined && Number.isFinite(value)) metrics[key] = value;
}

export function sampleMetrics(sample: HardwareSample): HardwareMetrics {
  const metrics: HardwareMetrics = {};
  put(metrics, "cpu.load", sample.cpu.loadPct);
  put(metrics, "cpu.temp", sample.cpu.packageTempC ?? sample.cpu.maxCoreTempC);
  put(metrics, "cpu.clock", sample.cpu.clockMhz);
  put(metrics, "cpu.power", sample.cpu.powerW);
  put(metrics, "memory.load", pct(sample.memory.usedBytes, sample.memory.totalBytes));
  for (const gpu of sample.gpus) {
    const key = `gpu.${gpu.index}`;
    put(metrics, `${key}.load`, gpu.loadPct);
    put(metrics, `${key}.temp`, gpu.tempC);
    put(metrics, `${key}.hotspot`, gpu.hotspotC);
    put(metrics, `${key}.power`, gpu.powerW);
    put(metrics, `${key}.clock`, gpu.coreClockMhz);
    put(metrics, `${key}.fan`, gpu.fanPct);
    if (gpu.vramUsedBytes !== null && gpu.vramTotalBytes)
      put(metrics, `${key}.vram`, pct(gpu.vramUsedBytes, gpu.vramTotalBytes));
    metrics[`${key}.throttle`] = gpu.thermalThrottling ? 1 : 0;
  }
  put(metrics, "disk.read", sample.disk.readBytesPerSec);
  put(metrics, "disk.write", sample.disk.writeBytesPerSec);
  put(metrics, "disk.active", sample.disk.activePct);
  for (const volume of sample.volumes)
    put(metrics, `volume.${volume.mount}.used`, pct(volume.usedBytes, volume.totalBytes));
  for (const drive of sample.driveTemps) put(metrics, `drive.${drive.diskId}.temp`, drive.tempC);
  return metrics;
}

export interface MetricInfo {
  readonly label: string;
  readonly unit: string;
}

export function metricInfo(
  metric: string,
  inventory?: HardwareInventory | null,
  sample?: HardwareSample | null,
): MetricInfo {
  const parts = metric.split(".");
  const [group, id = ""] = parts;
  const leaf = parts.at(-1) ?? "";
  const gpuName = (index: string) =>
    sample?.gpus.find((gpu) => gpu.index === Number(index))?.name ??
    inventory?.gpus.filter(isDiscreteGpu)[Number(index)]?.name;
  const driveName = (diskId: string) => inventory?.disks.find((disk) => disk.id === diskId)?.model;
  switch (group) {
    case "cpu":
      return (
        {
          load: { label: "CPU load", unit: "%" },
          temp: { label: "CPU temperature", unit: "°C" },
          clock: { label: "CPU clock", unit: "MHz" },
          power: { label: "CPU power", unit: "W" },
        }[leaf] ?? { label: metric, unit: "" }
      );
    case "memory":
      return { label: "Memory in use", unit: "%" };
    case "gpu": {
      const name = gpuName(id) ?? `GPU ${id}`;
      return (
        {
          load: { label: `${name} load`, unit: "%" },
          temp: { label: `${name} temperature`, unit: "°C" },
          hotspot: { label: `${name} hot spot`, unit: "°C" },
          power: { label: `${name} power`, unit: "W" },
          clock: { label: `${name} clock`, unit: "MHz" },
          fan: { label: `${name} fan`, unit: "%" },
          vram: { label: `${name} video memory`, unit: "%" },
          throttle: { label: `${name} thermal throttling`, unit: "" },
        }[leaf] ?? { label: metric, unit: "" }
      );
    }
    case "disk":
      return (
        {
          read: { label: "Disk reads", unit: "B/s" },
          write: { label: "Disk writes", unit: "B/s" },
          active: { label: "Disk busy", unit: "%" },
        }[leaf] ?? { label: metric, unit: "" }
      );
    case "volume":
      return { label: `Drive ${parts.slice(1, -1).join(".")} space used`, unit: "%" };
    case "drive":
      return { label: `${driveName(id) ?? `Drive ${id}`} temperature`, unit: "°C" };
    default:
      return { label: metric, unit: "" };
  }
}

/** Virtual and basic display adapters report no telemetry; they stay out of GPU numbering. */
export function isDiscreteGpu(gpu: HardwareInventory["gpus"][number]): boolean {
  return !/virtual|basic display|basic render|remote display|parsec|meta virtual/i.test(gpu.name);
}

type LimitSpec = Omit<HardwareLimit, "metric" | "label" | "unit">;

/**
 * Safe limits come from the parts themselves where the sensors report them (TjMax, the GPU
 * driver's slowdown headroom) and from conservative defaults elsewhere. Load alone is never
 * dangerous, so only sustained CPU saturation and memory exhaustion alert on usage.
 */
export function defaultLimits(
  sample: HardwareSample,
  inventory?: HardwareInventory | null,
): HardwareLimit[] {
  const metrics = sampleMetrics(sample);
  const specs: Record<string, LimitSpec> = {};
  const tjMax = sample.cpu.tjMaxC;
  specs["cpu.temp"] =
    tjMax !== null
      ? { warn: tjMax - 8, critical: tjMax - 2, sustainSeconds: 60, source: "spec" }
      : { warn: 90, critical: 98, sustainSeconds: 60, source: "default" };
  specs["cpu.load"] = { warn: 95, critical: 100, sustainSeconds: 600, source: "default" };
  specs["memory.load"] = { warn: 90, critical: 97, sustainSeconds: 120, source: "default" };
  for (const gpu of sample.gpus) {
    const key = `gpu.${gpu.index}`;
    specs[`${key}.temp`] =
      gpu.slowdownTempC !== null
        ? {
            warn: gpu.slowdownTempC - 5,
            critical: gpu.slowdownTempC,
            sustainSeconds: 60,
            source: "spec",
          }
        : { warn: 83, critical: 88, sustainSeconds: 60, source: "default" };
    specs[`${key}.hotspot`] = { warn: 100, critical: 108, sustainSeconds: 60, source: "default" };
    specs[`${key}.vram`] = { warn: 95, critical: 99, sustainSeconds: 120, source: "default" };
    specs[`${key}.throttle`] = { warn: 1, critical: 2, sustainSeconds: 30, source: "spec" };
  }
  for (const volume of sample.volumes)
    specs[`volume.${volume.mount}.used`] = {
      warn: 90,
      critical: 97,
      sustainSeconds: 0,
      source: "default",
    };
  for (const drive of sample.driveTemps) {
    const ssd = inventory?.disks.find((disk) => disk.id === drive.diskId)?.mediaType === "ssd";
    specs[`drive.${drive.diskId}.temp`] = ssd
      ? { warn: 70, critical: 80, sustainSeconds: 120, source: "default" }
      : { warn: 50, critical: 55, sustainSeconds: 120, source: "default" };
  }
  return Object.entries(specs)
    .filter(([metric]) => metric in metrics)
    .map(([metric, spec]) => ({ metric, ...metricInfo(metric, inventory, sample), ...spec }));
}

export interface LimitOverride {
  readonly warn: number | null;
  readonly critical: number | null;
}

export function applyLimitOverrides(
  limits: ReadonlyArray<HardwareLimit>,
  overrides: Readonly<Record<string, LimitOverride>>,
): HardwareLimit[] {
  return limits.map((limit) => {
    const override = overrides[limit.metric];
    if (!override || (override.warn === null && override.critical === null)) return limit;
    return {
      ...limit,
      warn: override.warn ?? limit.warn,
      critical: override.critical ?? limit.critical,
      source: "user",
    };
  });
}

// ── Alert engine ────────────────────────────────────────────────────────────

/** A breach clears only after dropping this far below the warning line, so values hovering on it do not flap. */
const hysteresis = (unit: string) => (unit === "°C" ? 3 : unit === "%" ? 3 : 0.5);
export const ALERT_COOLDOWN_MS = 30 * 60_000;
const MAX_RESOLVED_ALERTS = 50;

interface MetricBreach {
  readonly since: number;
  readonly peak: number;
}

export interface AlertEngineState {
  readonly breaches: Readonly<Record<string, MetricBreach>>;
  readonly alerts: ReadonlyArray<HardwareAlert>;
  /** When a metric's last alert resolved; a new warning inside the cooldown stays quiet. */
  readonly resolvedAt: Readonly<Record<string, number>>;
}

export const emptyAlertEngineState: AlertEngineState = { breaches: {}, alerts: [], resolvedAt: {} };

export interface AlertTransition {
  readonly kind: "opened" | "escalated" | "resolved";
  readonly alert: HardwareAlert;
}

function alertMessage(limit: HardwareLimit, severity: HardwareAlertSeverity, value: number) {
  const shown = `${Math.round(value)}${limit.unit === "%" ? "%" : ` ${limit.unit}`}`;
  if (limit.metric.endsWith(".throttle"))
    return `${limit.label.replace(" thermal throttling", "")} is slowing itself down because it is too hot.`;
  const line = severity === "critical" ? limit.critical : limit.warn;
  return `${limit.label} is ${shown}, above the safe ${severity === "critical" ? "limit" : "range"} of ${Math.round(line)}${limit.unit === "%" ? "%" : ` ${limit.unit}`}.`;
}

export function evaluateAlerts(
  state: AlertEngineState,
  metrics: HardwareMetrics,
  limits: ReadonlyArray<HardwareLimit>,
  now: number,
): { state: AlertEngineState; transitions: AlertTransition[] } {
  const breaches: Record<string, MetricBreach> = { ...state.breaches };
  const resolvedAt: Record<string, number> = { ...state.resolvedAt };
  let alerts = [...state.alerts];
  const transitions: AlertTransition[] = [];
  const openIndex = (metric: string) =>
    alerts.findIndex(
      (alert) => alert.metric === metric && alert.resolvedAt === null && alert.severity !== "drift",
    );

  for (const limit of limits) {
    const value = metrics[limit.metric];
    const index = openIndex(limit.metric);
    if (value === undefined) continue;
    const level: HardwareAlertSeverity | null =
      value >= limit.critical ? "critical" : value >= limit.warn ? "warning" : null;

    if (level === null) {
      const clear = value < limit.warn - hysteresis(limit.unit);
      if (!clear) {
        if (index >= 0) alerts[index] = { ...alerts[index]!, value, lastSeenAt: now };
        continue;
      }
      delete breaches[limit.metric];
      if (index >= 0) {
        const resolved = { ...alerts[index]!, value, lastSeenAt: now, resolvedAt: now };
        alerts[index] = resolved;
        resolvedAt[limit.metric] = now;
        transitions.push({ kind: "resolved", alert: resolved });
      }
      continue;
    }

    const breach = breaches[limit.metric];
    const since = breach?.since ?? now;
    const peak = Math.max(breach?.peak ?? value, value);
    breaches[limit.metric] = { since, peak };

    if (index >= 0) {
      const current = alerts[index]!;
      const escalate = level === "critical" && current.severity === "warning";
      const next: HardwareAlert = {
        ...current,
        value,
        peak: Math.max(current.peak, value),
        lastSeenAt: now,
        ...(escalate
          ? {
              severity: "critical",
              limit: limit.critical,
              message: alertMessage(limit, "critical", value),
              acknowledged: false,
            }
          : {}),
      };
      alerts[index] = next;
      if (escalate) transitions.push({ kind: "escalated", alert: next });
      continue;
    }

    if (now - since < limit.sustainSeconds * 1000) continue;
    const cooling = now - (resolvedAt[limit.metric] ?? -Infinity) < ALERT_COOLDOWN_MS;
    if (cooling && level !== "critical") continue;
    const alert: HardwareAlert = {
      id: `${limit.metric}@${since}`,
      metric: limit.metric,
      label: limit.label,
      severity: level,
      unit: limit.unit,
      value,
      peak,
      limit: level === "critical" ? limit.critical : limit.warn,
      message: alertMessage(limit, level, value),
      startedAt: since,
      lastSeenAt: now,
      resolvedAt: null,
      acknowledged: false,
      threadId: null,
    };
    alerts.push(alert);
    transitions.push({ kind: "opened", alert });
  }

  alerts = trimResolved(alerts);
  return { state: { breaches, alerts, resolvedAt }, transitions };
}

function trimResolved(alerts: HardwareAlert[]): HardwareAlert[] {
  const resolved = alerts.filter((alert) => alert.resolvedAt !== null);
  if (resolved.length <= MAX_RESOLVED_ALERTS) return alerts;
  const drop = new Set(
    resolved
      .toSorted((a, b) => a.resolvedAt! - b.resolvedAt!)
      .slice(0, resolved.length - MAX_RESOLVED_ALERTS)
      .map((alert) => alert.id),
  );
  return alerts.filter((alert) => !drop.has(alert.id));
}

// ── History rollups and drift ───────────────────────────────────────────────

export function rollup(at: number, samples: ReadonlyArray<HardwareMetrics>): HardwareHistoryPoint {
  const sum: Record<string, number> = {};
  const count: Record<string, number> = {};
  const max: Record<string, number> = {};
  for (const metrics of samples)
    for (const [key, value] of Object.entries(metrics)) {
      sum[key] = (sum[key] ?? 0) + value;
      count[key] = (count[key] ?? 0) + 1;
      max[key] = Math.max(max[key] ?? -Infinity, value);
    }
  const avg: Record<string, number> = {};
  for (const key of Object.keys(sum)) avg[key] = round(sum[key]! / count[key]!);
  for (const key of Object.keys(max)) max[key] = round(max[key]!);
  return { at, avg, max };
}

/** Merges finer points into one coarser point, weighting every input point equally. */
export function mergePoints(
  at: number,
  points: ReadonlyArray<HardwareHistoryPoint>,
): HardwareHistoryPoint {
  const merged = rollup(
    at,
    points.map((point) => point.avg),
  );
  const max: Record<string, number> = {};
  for (const point of points)
    for (const [key, value] of Object.entries(point.max))
      max[key] = Math.max(max[key] ?? -Infinity, value);
  return { at, avg: merged.avg, max };
}

const round = (value: number) => Math.round(value * 100) / 100;

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export const DRIFT_LEARNING_MS = 7 * 24 * 60 * 60_000;
const IDLE_LOAD_PCT = 20;
const DRIFT_TEMP_C = 10;

export interface DriftFinding {
  readonly metric: string;
  readonly baseline: number;
  readonly recent: number;
}

/**
 * Compares idle temperatures over the last day with the machine's own idle normal from the days
 * before. Comparing idle to idle removes workload from the picture, so a rise points at cooling
 * (dust, a failing fan, dried thermal paste) rather than at what the user ran.
 */
export function findTemperatureDrift(
  points: ReadonlyArray<HardwareHistoryPoint>,
  now: number,
): DriftFinding[] {
  const recentFrom = now - 24 * 60 * 60_000;
  const findings: DriftFinding[] = [];
  const temps = new Set<string>();
  for (const point of points)
    for (const key of Object.keys(point.avg))
      if (/^(cpu|gpu\.\d+)\.temp$/.test(key)) temps.add(key);
  for (const metric of temps) {
    const loadKey = metric.replace(/\.temp$/, ".load");
    const idle = (point: HardwareHistoryPoint) =>
      point.avg[metric] !== undefined && (point.avg[loadKey] ?? 0) < IDLE_LOAD_PCT;
    const before = points.filter((point) => point.at < recentFrom && idle(point));
    const recent = points.filter((point) => point.at >= recentFrom && idle(point));
    // A handful of idle hours on each side keeps one odd hour from raising an alert.
    if (before.length < 12 || recent.length < 3) continue;
    const baseline = median(before.map((point) => point.avg[metric]!));
    const current = median(recent.map((point) => point.avg[metric]!));
    if (baseline !== null && current !== null && current - baseline >= DRIFT_TEMP_C)
      findings.push({ metric, baseline: round(baseline), recent: round(current) });
  }
  return findings;
}
