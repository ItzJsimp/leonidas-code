import type {
  HardwareAlert,
  HardwareHistoryPoint,
  HardwareLimit,
  HardwareSample,
} from "@t3tools/contracts";

export type SystemHealth = "good" | "warning" | "critical" | "unknown";

export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (Math.abs(value) >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${units[unit]}`;
}

const formatRate = (bytesPerSec: number | null | undefined) =>
  bytesPerSec === null || bytesPerSec === undefined ? "-" : `${formatBytes(bytesPerSec)}/s`;

export function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  if (unit === "B/s") return formatRate(value);
  if (unit === "%") return `${Math.round(value)}%`;
  if (unit === "°C") return `${Math.round(value)} °C`;
  if (unit === "MHz")
    return value >= 1000 ? `${(value / 1000).toFixed(2)} GHz` : `${Math.round(value)} MHz`;
  if (unit === "W") return `${value.toFixed(value < 10 ? 1 : 0)} W`;
  if (unit === "V") return `${value.toFixed(3)} V`;
  if (unit === "RPM") return `${Math.round(value)} RPM`;
  return unit ? `${Math.round(value * 100) / 100} ${unit}` : String(Math.round(value * 100) / 100);
}

export const openAlerts = (alerts: ReadonlyArray<HardwareAlert>) =>
  alerts.filter((alert) => alert.resolvedAt === null);

/** Acknowledged alerts stay listed but no longer color the health dot. */
export function systemHealth(alerts: ReadonlyArray<HardwareAlert>, hasData: boolean): SystemHealth {
  const active = openAlerts(alerts).filter((alert) => !alert.acknowledged);
  if (active.some((alert) => alert.severity === "critical")) return "critical";
  if (active.length > 0) return "warning";
  return hasData ? "good" : "unknown";
}

export const HEALTH_LABEL: Record<SystemHealth, string> = {
  good: "Healthy",
  warning: "Needs a look",
  critical: "Running too hot or too full",
  unknown: "Waiting for data",
};

/** Where a reading sits against its limit, for meter color. */
export function limitLevel(
  value: number | null | undefined,
  limit: HardwareLimit | undefined,
): "ok" | "warning" | "critical" {
  if (value === null || value === undefined || !limit) return "ok";
  if (value >= limit.critical) return "critical";
  if (value >= limit.warn) return "warning";
  return "ok";
}

/** Keeps the newest `size` live samples for sparklines; the page only lives while open. */
export function appendSample(
  buffer: ReadonlyArray<HardwareSample>,
  sample: HardwareSample | null,
  size = 120,
): ReadonlyArray<HardwareSample> {
  if (!sample || buffer.at(-1)?.at === sample.at) return buffer;
  const next = [...buffer, sample];
  return next.length > size ? next.slice(next.length - size) : next;
}

/** SVG polyline points in a 100×`height` box; gaps (missing values) break nothing, they are skipped. */
export function sparklinePoints(
  values: ReadonlyArray<number | null>,
  options: { min?: number | undefined; max?: number | undefined; height?: number | undefined } = {},
): string {
  const present = values.filter((value): value is number => value !== null);
  if (present.length < 2) return "";
  const height = options.height ?? 32;
  const min = options.min ?? Math.min(...present);
  const max = Math.max(options.max ?? Math.max(...present), min + 1);
  const step = 100 / Math.max(1, values.length - 1);
  const points: string[] = [];
  values.forEach((value, index) => {
    if (value === null) return;
    const y = height - ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * height;
    points.push(`${(index * step).toFixed(2)},${y.toFixed(2)}`);
  });
  return points.join(" ");
}

export function historySeries(
  points: ReadonlyArray<HardwareHistoryPoint>,
  metric: string,
  kind: "avg" | "max" = "avg",
): Array<number | null> {
  return points.map((point) => point[kind][metric] ?? null);
}

/** Metrics present anywhere in a history window, grouped for the History picker. */
export function historyMetrics(points: ReadonlyArray<HardwareHistoryPoint>): string[] {
  const keys = new Set<string>();
  for (const point of points) for (const key of Object.keys(point.avg)) keys.add(key);
  const order = ["cpu", "gpu", "memory", "drive", "disk", "volume"];
  return [...keys]
    .filter((key) => !key.endsWith(".throttle") && !key.endsWith(".clock"))
    .toSorted((a, b) => {
      const groupA = order.indexOf(a.split(".")[0]!);
      const groupB = order.indexOf(b.split(".")[0]!);
      return groupA === groupB ? a.localeCompare(b) : groupA - groupB;
    });
}

export function relativeTime(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export type MetricGroup = "Processor" | "Graphics" | "Memory" | "Storage";
export const METRIC_GROUPS: ReadonlyArray<MetricGroup> = [
  "Processor",
  "Graphics",
  "Memory",
  "Storage",
];

export function metricGroup(metric: string): MetricGroup {
  const head = metric.split(".")[0];
  if (head === "cpu") return "Processor";
  if (head === "gpu") return "Graphics";
  if (head === "memory") return "Memory";
  return "Storage";
}

const SHORT_LABELS: Record<string, string> = {
  load: "Busy",
  temp: "Temperature",
  hotspot: "Hot spot",
  power: "Power",
  clock: "Speed",
  fan: "Fan",
  vram: "Video memory",
  read: "Reads",
  write: "Writes",
  active: "Busy",
  used: "Space used",
};

/** Short chip text inside a group, where the group heading already says Processor or Graphics. */
export function shortMetricLabel(metric: string, fullLabel: string): string {
  const parts = metric.split(".");
  const head = parts[0];
  if (head === "memory") return "In use";
  if (head === "volume") return `${parts.slice(1, -1).join(".")} space`;
  if (head === "drive") return fullLabel.replace(/ temperature$/, "");
  return SHORT_LABELS[parts.at(-1) ?? ""] ?? fullLabel;
}

export interface SeriesStats {
  readonly latest: number | null;
  readonly min: number | null;
  readonly avg: number | null;
  readonly max: number | null;
}

export function seriesStats(values: ReadonlyArray<number | null>): SeriesStats {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return { latest: null, min: null, avg: null, max: null };
  return {
    latest: present.at(-1) ?? null,
    min: Math.min(...present),
    avg: present.reduce((sum, value) => sum + value, 0) / present.length,
    max: Math.max(...present),
  };
}

export const RANGE_LABEL = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
  "90d": "90 days",
} as const;

/** Whole-number step for a limit stepper, and the bounds it may be moved within. */
function limitBounds(unit: string): { step: number; min: number; max: number } {
  if (unit === "%") return { step: 5, min: 10, max: 100 };
  if (unit === "°C") return { step: 1, min: 20, max: 120 };
  return { step: 1, min: 0, max: 1000 };
}

export function stepLimit(value: number, direction: 1 | -1, unit: string): number {
  const { step, min, max } = limitBounds(unit);
  return Math.min(max, Math.max(min, Math.round(value + direction * step)));
}

/** Scale top for a limit bar, so the warn and critical marks never sit at the very edge. */
export function limitScaleMax(limit: Pick<HardwareLimit, "critical" | "unit">): number {
  if (limit.unit === "%") return 100;
  return Math.ceil((limit.critical * 1.15) / 10) * 10;
}

/** Limits where moving the numbers makes sense: rates, throttle flags and clocks are not editable. */
export const isEditableLimit = (limit: Pick<HardwareLimit, "metric" | "unit">) =>
  (limit.unit === "%" || limit.unit === "°C") && !limit.metric.endsWith(".throttle");
