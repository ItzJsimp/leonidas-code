import type {
  HardwareAlert,
  HardwareHistoryPoint,
  HardwareLimit,
  HardwareSample,
} from "@t3tools/contracts";

export type SystemHealth = "good" | "warning" | "critical" | "unknown";

export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (Math.abs(value) >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${units[unit]}`;
}

export const formatRate = (bytesPerSec: number | null | undefined) =>
  bytesPerSec === null || bytesPerSec === undefined ? "—" : `${formatBytes(bytesPerSec)}/s`;

export function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
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
