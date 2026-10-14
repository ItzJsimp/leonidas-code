import type { HardwareHistoryRange, HardwareLimit } from "@t3tools/contracts";
import { useMemo, useState } from "react";

import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import {
  HEALTH_LABEL,
  formatBytes,
  formatValue,
  historyMetrics,
  historySeries,
  limitLevel,
  openAlerts,
  relativeTime,
  sparklinePoints,
  systemHealth,
} from "./systemCare.logic";
import {
  useSystemCareActions,
  useSystemCareHistory,
  useSystemCareInventory,
  useSystemCareLimits,
  useSystemCareLive,
} from "./useSystemCare";

const LEVEL_CLASS = {
  ok: "text-foreground",
  warning: "text-warning",
  critical: "text-destructive",
} as const;
const HEALTH_DOT = {
  good: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  unknown: "bg-muted-foreground/40",
} as const;
const RANGES: ReadonlyArray<HardwareHistoryRange> = ["1h", "24h", "7d", "90d"];

function Sparkline(props: {
  values: ReadonlyArray<number | null>;
  min?: number | undefined;
  max?: number | undefined;
}) {
  const points = sparklinePoints(props.values, { min: props.min, max: props.max });
  if (!points) return <div className="h-8" />;
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full text-primary">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Meter(props: {
  label: string;
  value: number | null;
  unit: string;
  detail?: string | undefined;
  limit?: HardwareLimit | undefined;
  trend: ReadonlyArray<number | null>;
  max?: number | undefined;
}) {
  const level = limitLevel(props.value, props.limit);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", LEVEL_CLASS[level])}>
        {formatValue(props.value, props.unit)}
      </div>
      <div className="min-h-4 text-xs text-muted-foreground">{props.detail ?? ""}</div>
      <Sparkline values={props.trend} min={0} max={props.max} />
    </div>
  );
}

function LimitField(props: {
  label: string;
  value: number;
  unit: string;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(props.value));
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {props.label}
      <input
        className="w-16 rounded-md border bg-background px-1.5 py-0.5 text-sm text-foreground"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);
          if (Number.isFinite(next) && next !== props.value) props.onSave(next);
          else setDraft(String(props.value));
        }}
      />
      {props.unit}
    </label>
  );
}

export function SystemCarePage() {
  const live = useSystemCareLive();
  const inventory = useSystemCareInventory();
  const limitsView = useSystemCareLimits();
  const actions = useSystemCareActions();
  const [range, setRange] = useState<HardwareHistoryRange>("24h");
  const [metric, setMetric] = useState<string | null>(null);
  const history = useSystemCareHistory(range);

  const limits = useMemo(
    () => new Map((limitsView.data?.limits ?? []).map((limit) => [limit.metric, limit])),
    [limitsView.data],
  );
  const sample = live.sample;
  const health = systemHealth(live.alerts, sample !== null);
  const alerts = openAlerts(live.alerts);
  const points = history.data?.points ?? [];
  const metrics = useMemo(() => historyMetrics(points), [points]);
  const activeMetric = metric && metrics.includes(metric) ? metric : (metrics[0] ?? null);
  const gpu = sample?.gpus[0];
  const memPct = (s: { memory: { usedBytes: number; totalBytes: number } }) =>
    (s.memory.usedBytes / Math.max(1, s.memory.totalBytes)) * 100;
  const supported = live.status?.supported ?? true;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-center gap-3">
          <span className={cn("size-3 rounded-full", HEALTH_DOT[health])} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">System Care</h1>
            <p className="text-sm text-muted-foreground">
              {HEALTH_LABEL[health]}
              {inventory.data ? ` · ${inventory.data.cpu.name}` : ""}
            </p>
          </div>
          <Button
            disabled={actions.busy || !supported}
            onClick={() => void actions.start("checkup")}
          >
            {actions.busy ? <Spinner /> : null}
            Run a checkup
          </Button>
        </header>

        {live.error ? <p className="text-sm text-destructive">{live.error}</p> : null}
        {!supported ? (
          <p className="text-sm text-muted-foreground">
            System Care is not available on this machine yet.
          </p>
        ) : live.isPending ? (
          <Spinner />
        ) : null}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Meter
            label="Processor"
            value={sample?.cpu.loadPct ?? null}
            unit="%"
            detail={
              sample
                ? `${formatValue(sample.cpu.packageTempC, "°C")} · ${formatValue(sample.cpu.clockMhz, "MHz")}`
                : ""
            }
            limit={limits.get("cpu.temp")}
            trend={live.samples.map((s) => s.cpu.loadPct)}
            max={100}
          />
          <Meter
            label="Graphics"
            value={gpu?.loadPct ?? null}
            unit="%"
            detail={
              gpu
                ? `${formatValue(gpu.tempC, "°C")} · ${formatBytes(gpu.vramUsedBytes, 0)} VRAM`
                : "No GPU reading"
            }
            limit={limits.get("gpu.temp")}
            trend={live.samples.map((s) => s.gpus[0]?.loadPct ?? null)}
            max={100}
          />
          <Meter
            label="Memory"
            value={sample ? memPct(sample) : null}
            unit="%"
            detail={
              sample
                ? `${formatBytes(sample.memory.usedBytes)} of ${formatBytes(sample.memory.totalBytes, 0)}`
                : ""
            }
            limit={limits.get("memory.used")}
            trend={live.samples.map(memPct)}
            max={100}
          />
          <Meter
            label="Disk activity"
            value={sample?.disk.activePct ?? null}
            unit="%"
            detail={sample ? `${formatBytes(sample.disk.readBytesPerSec, 0)}/s read` : ""}
            trend={live.samples.map((s) => s.disk.activePct)}
            max={100}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs attention.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <Badge variant={alert.severity === "critical" ? "error" : "warning"}>
                    {alert.severity}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{alert.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {alert.label} · since {relativeTime(alert.startedAt, Date.now())}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actions.busy}
                    onClick={() => void actions.start("investigate", alert.id)}
                  >
                    Investigate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void actions.setAcknowledged(alert.id, !alert.acknowledged)}
                  >
                    {alert.acknowledged ? "Unmute" : "Dismiss"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-sm font-semibold">History</h2>
            {RANGES.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={value === range ? "default" : "outline"}
                onClick={() => setRange(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          {metrics.length > 0 ? (
            <select
              className="w-fit rounded-md border bg-background px-2 py-1 text-sm"
              value={activeMetric ?? ""}
              onChange={(event) => setMetric(event.target.value)}
            >
              {metrics.map((key) => (
                <option key={key} value={key}>
                  {limits.get(key)?.label ?? key}
                </option>
              ))}
            </select>
          ) : null}
          <div className="rounded-lg border bg-card p-3">
            {activeMetric ? (
              <Sparkline values={historySeries(points, activeMetric)} min={0} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {history.isPending ? "Loading history..." : "History fills in as System Care runs."}
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Deep sensors</h2>
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <div className="min-w-0 flex-1 text-sm">
              Fans, voltages and every temperature.
              <div className="text-xs text-muted-foreground">
                {live.status?.deepSensorsMessage ?? `Status: ${live.status?.deepSensors ?? "off"}`}
              </div>
            </div>
            <Switch
              aria-label="Deep sensors"
              checked={live.status?.deepSensors === "on" || live.status?.deepSensors === "starting"}
              onCheckedChange={(enabled) => void actions.setDeepSensors(enabled)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Alert limits</h2>
          <ul className="flex flex-col gap-1">
            {[...limits.values()].map((limit) => (
              <li key={limit.metric} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{limit.label}</span>
                <LimitField
                  label="Warn"
                  value={limit.warn}
                  unit={limit.unit}
                  onSave={(warn) => void limitsView.save(limit.metric, warn, limit.critical)}
                />
                <LimitField
                  label="Critical"
                  value={limit.critical}
                  unit={limit.unit}
                  onSave={(critical) => void limitsView.save(limit.metric, limit.warn, critical)}
                />
                <Badge variant="outline">{limit.source}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
