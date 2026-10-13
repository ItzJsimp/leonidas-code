import type {
  EnvironmentId,
  ModelBenchmarkEntry,
  ModelBenchmarkMetric,
  ModelSelection,
} from "@t3tools/contracts";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildPoints,
  isLogMetric,
  paretoFrontier,
  scaleValue,
  sortEntries,
  type ExplorerPoint,
  type ExplorerSort,
} from "../../lib/benchmarkExplorer";
import {
  benchmarkQueries,
  formatBenchmarkValue,
  type BenchmarkCandidate,
} from "../../lib/modelBenchmarks";
import { cn } from "../../lib/utils";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogPanel, DialogPopup, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Spinner } from "../ui/spinner";
import { Toggle, ToggleGroup } from "../ui/toggle-group";

/** Creator dot colors; creators past the palette share the last, neutral one. */
const CREATOR_COLORS = [
  "#d97757",
  "#4a90d9",
  "#3fb27f",
  "#e0a030",
  "#a06ad6",
  "#e0607e",
  "#38b6c4",
] as const;
const OTHER_COLOR = "#8b8b95";
const DEFAULT_TOP_MODELS = 15;

type XKind = "price" | "speed" | "latency";
const X_KINDS: ReadonlyArray<{ readonly id: XKind; readonly label: string }> = [
  { id: "price", label: "Cost" },
  { id: "speed", label: "Speed" },
  { id: "latency", label: "Latency" },
];

const WIDTH = 640;
const HEIGHT = 300;
const PAD = { left: 40, right: 14, top: 12, bottom: 30 };

function niceTicks(min: number, max: number, log: boolean): ReadonlyArray<number> {
  if (log) {
    const ticks: number[] = [];
    for (let power = Math.floor(Math.log10(min)); power <= Math.ceil(Math.log10(max)); power++) {
      ticks.push(10 ** power);
    }
    return ticks;
  }
  return Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
}

const tickLabel = (value: number) =>
  value >= 100
    ? value.toFixed(0)
    : value >= 1
      ? value.toFixed(1).replace(/\.0$/, "")
      : String(value);

function Scatter({
  points,
  frontier,
  xMetric,
  yMetric,
  colorOf,
  connectedKeys,
  hovered,
  onHover,
}: {
  readonly points: ReadonlyArray<ExplorerPoint>;
  readonly frontier: ReadonlyArray<ExplorerPoint>;
  readonly xMetric: ModelBenchmarkMetric;
  readonly yMetric: ModelBenchmarkMetric;
  readonly colorOf: (entry: ModelBenchmarkEntry) => string;
  readonly connectedKeys: ReadonlySet<string>;
  readonly hovered: string | null;
  readonly onHover: (key: string | null) => void;
}) {
  const xLog = isLogMetric(xMetric);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.08 || 1;
  const x = (value: number) =>
    PAD.left + scaleValue(value, xMin, xMax, xLog) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) =>
    HEIGHT -
    PAD.bottom -
    scaleValue(value, yMin - yPad, yMax + yPad, false) * (HEIGHT - PAD.top - PAD.bottom);
  const xTicks = niceTicks(xMin, xMax, xLog).filter(
    (tick) => tick >= xMin * 0.999 && tick <= xMax * 1.001,
  );
  const yTicks = niceTicks(yMin, yMax, false);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${yMetric.label} against ${xMetric.label}`}
      className="h-auto w-full text-muted-foreground"
    >
      {yTicks.map((tick) => (
        <g key={`y${tick}`}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="currentColor"
            strokeOpacity={0.12}
          />
          <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={10} fill="currentColor">
            {tickLabel(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text
          key={`x${tick}`}
          x={x(tick)}
          y={HEIGHT - PAD.bottom + 14}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
        >
          {tickLabel(tick)}
        </text>
      ))}
      <text
        x={(WIDTH + PAD.left) / 2}
        y={HEIGHT - 3}
        textAnchor="middle"
        fontSize={10}
        fill="currentColor"
      >
        {xMetric.label}
        {xLog ? " (log scale)" : ""}
      </text>
      {frontier.length > 1 ? (
        <polyline
          points={frontier.map((point) => `${x(point.x)},${y(point.y)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.6}
          strokeDasharray="2 4"
          strokeWidth={1.5}
        />
      ) : null}
      {points.map((point) => {
        const key = point.entry.sourceModelKey;
        const active = hovered === key;
        return (
          <circle
            key={key}
            cx={x(point.x)}
            cy={y(point.y)}
            r={active ? 7 : 5}
            fill={colorOf(point.entry)}
            stroke={connectedKeys.has(key) ? "currentColor" : "none"}
            strokeWidth={2}
            opacity={hovered && !active ? 0.45 : 1}
            onPointerEnter={() => onHover(key)}
            onPointerLeave={() => onHover(null)}
          />
        );
      })}
    </svg>
  );
}

function ModelPicker({
  entries,
  selected,
  onChange,
  connectedKeys,
}: {
  readonly entries: ReadonlyArray<ModelBenchmarkEntry>;
  readonly selected: ReadonlySet<string>;
  readonly onChange: (next: Set<string>) => void;
  readonly connectedKeys: ReadonlySet<string>;
}) {
  const [search, setSearch] = useState("");
  const shown = entries.filter((entry) =>
    entry.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="xs" variant="outline">
            {selected.size} of {entries.length} models
            <ChevronsUpDownIcon aria-hidden />
          </Button>
        }
      />
      <PopoverPopup align="start" className="w-72">
        <div className="flex flex-col gap-2">
          <Input
            size="sm"
            placeholder="Search models"
            aria-label="Search models"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex gap-1 text-2xs">
            <Button size="xs" variant="ghost" onClick={() => onChange(new Set(connectedKeys))}>
              Connected
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onChange(new Set(entries.map((entry) => entry.sourceModelKey)))}
            >
              All
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onChange(new Set())}>
              None
            </Button>
          </div>
          <ul className="flex max-h-64 flex-col overflow-y-auto [scrollbar-width:thin]">
            {shown.map((entry) => {
              const key = entry.sourceModelKey;
              return (
                <li key={key}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-muted/60">
                    <Checkbox
                      checked={selected.has(key)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selected);
                        if (checked) next.add(key);
                        else next.delete(key);
                        onChange(next);
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    {connectedKeys.has(key) ? (
                      <span className="text-2xs text-muted-foreground">yours</span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function ExplorerBody({
  environmentId,
  candidates,
  onStartChat,
  onClose,
}: {
  readonly environmentId: EnvironmentId;
  readonly candidates: ReadonlyArray<BenchmarkCandidate>;
  readonly onStartChat: ((selection: ModelSelection) => void) | null;
  readonly onClose: () => void;
}) {
  const catalogQuery = useEnvironmentQuery(
    serverEnvironment.modelBenchmarkCatalog({ environmentId, input: {} }),
  );
  const models = useMemo(() => benchmarkQueries(candidates), [candidates]);
  const connectedQuery = useEnvironmentQuery(
    models.length === 0
      ? null
      : serverEnvironment.modelBenchmarks({ environmentId, input: { models } }),
  );
  const catalog = catalogQuery.data;

  const [xKind, setXKind] = useState<XKind>("price");
  const [xKey, setXKey] = useState<string | null>(null);
  const [yKey, setYKey] = useState<string | null>(null);
  const [creator, setCreator] = useState<string>("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [sort, setSort] = useState<ExplorerSort>({ key: "y", direction: "desc" });

  /** Source model key to the candidate the user can start a chat with. */
  const connected = useMemo(() => {
    const byKey = new Map<string, BenchmarkCandidate>();
    for (const row of connectedQuery.data?.rows ?? []) {
      const match = row.matches[0]?.entry;
      const candidate = candidates.find(
        (item) =>
          item.query.modelId === row.query.modelId && item.query.effort === row.query.effort,
      );
      if (match && candidate && !byKey.has(match.sourceModelKey))
        byKey.set(match.sourceModelKey, candidate);
    }
    return byKey;
  }, [connectedQuery.data, candidates]);
  const connectedKeys = useMemo(() => new Set(connected.keys()), [connected]);

  const xMetrics = (catalog?.metrics ?? []).filter((metric) => metric.kind === xKind);
  const yMetrics = (catalog?.metrics ?? []).filter((metric) => metric.kind === "score");
  const xMetric =
    xMetrics.find((metric) => metric.key === xKey) ??
    xMetrics.find((m) => m.key.endsWith("output")) ??
    xMetrics[0];
  const yMetric = yMetrics.find((metric) => metric.key === yKey) ?? yMetrics[0];

  const creators = useMemo(
    () =>
      [
        ...new Set(
          (catalog?.entries ?? []).flatMap((entry) => (entry.creator ? [entry.creator] : [])),
        ),
      ].toSorted(),
    [catalog],
  );
  const colorOf = (entry: ModelBenchmarkEntry) => {
    const index = entry.creator ? creators.indexOf(entry.creator) : -1;
    return index >= 0 && index < CREATOR_COLORS.length ? CREATOR_COLORS[index]! : OTHER_COLOR;
  };

  const inCreator = useMemo(
    () =>
      (catalog?.entries ?? []).filter((entry) => creator === "all" || entry.creator === creator),
    [catalog, creator],
  );
  // Default view: the models you can run plus the strongest few, like AA's curated chart.
  const selected = useMemo(() => {
    if (picked) return picked;
    const top = yMetric
      ? sortEntries(inCreator, { key: yMetric.key, direction: "desc" }).slice(0, DEFAULT_TOP_MODELS)
      : [];
    return new Set([...top.map((entry) => entry.sourceModelKey), ...connectedKeys]);
  }, [picked, inCreator, yMetric, connectedKeys]);

  const visible = inCreator.filter((entry) => selected.has(entry.sourceModelKey));
  const points = useMemo(
    () => (xMetric && yMetric ? buildPoints(visible, xMetric, yMetric) : []),
    [visible, xMetric, yMetric],
  );
  const frontier = useMemo(
    () => (xMetric && yMetric ? paretoFrontier(points, xMetric, yMetric) : []),
    [points, xMetric, yMetric],
  );
  const rows = useMemo(
    () =>
      sortEntries(
        visible,
        sort.key === "y" && yMetric
          ? { ...sort, key: yMetric.key }
          : sort.key === "x" && xMetric
            ? { ...sort, key: xMetric.key }
            : sort,
      ),
    [visible, sort, xMetric, yMetric],
  );

  if (!catalog) {
    return (
      <p className="flex items-center gap-2 py-10 text-xs text-muted-foreground">
        {catalogQuery.isPending ? (
          <>
            <Spinner className="size-3.5" /> Loading benchmarks
          </>
        ) : (
          (catalogQuery.error ?? "Benchmarks are unavailable.")
        )}
      </p>
    );
  }
  if (!xMetric || !yMetric) {
    return (
      <p className="py-10 text-xs text-muted-foreground">No benchmark data for this view yet.</p>
    );
  }

  const source = catalog.sources[0];
  const hoveredEntry = hovered
    ? visible.find((entry) => entry.sourceModelKey === hovered)
    : undefined;
  const header = (label: string, key: string, align: "left" | "right") => {
    const active = sort.key === key;
    return (
      <th className={cn("px-2 py-1 font-medium", align === "right" ? "text-right" : "text-left")}>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-0.5 hover:text-foreground"
          onClick={() =>
            setSort(
              active
                ? { key, direction: sort.direction === "desc" ? "asc" : "desc" }
                : { key, direction: key === "name" ? "asc" : "desc" },
            )
          }
        >
          {label}
          {active ? (
            sort.direction === "desc" ? (
              <ArrowDownIcon aria-hidden className="size-3" />
            ) : (
              <ArrowUpIcon aria-hidden className="size-3" />
            )
          ) : null}
        </button>
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          aria-label="Compare score against"
          value={[xKind]}
          onValueChange={(next) => {
            const value = X_KINDS.find((entry) => entry.id === next[0]);
            if (!value) return;
            setXKind(value.id);
            setXKey(null);
          }}
        >
          {X_KINDS.map((entry) => (
            <Toggle key={entry.id} value={entry.id}>
              {entry.label}
            </Toggle>
          ))}
        </ToggleGroup>
        {xMetrics.length > 1 ? (
          <Select value={xMetric.key} onValueChange={(value) => setXKey(value)}>
            <SelectTrigger aria-label="X axis" size="xs">
              <SelectValue>{xMetric.label}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {xMetrics.map((metric) => (
                <SelectItem key={metric.key} value={metric.key}>
                  {metric.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null}
        <Select value={yMetric.key} onValueChange={(value) => setYKey(value)}>
          <SelectTrigger aria-label="Benchmark" size="xs" className="max-w-56">
            <SelectValue>{yMetric.label}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {yMetrics.map((metric) => (
              <SelectItem key={metric.key} value={metric.key}>
                {metric.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Select
          value={creator}
          onValueChange={(value) => {
            setCreator(value ?? "all");
            setPicked(null);
          }}
        >
          <SelectTrigger aria-label="Creator" size="xs">
            <SelectValue>{creator === "all" ? "All creators" : creator}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="all">All creators</SelectItem>
            {creators.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <ModelPicker
          entries={inCreator}
          selected={selected}
          onChange={setPicked}
          connectedKeys={connectedKeys}
        />
      </div>

      <div className="relative rounded-xl border border-border/60 bg-muted/10 p-2">
        {points.length > 0 ? (
          <Scatter
            points={points}
            frontier={frontier}
            xMetric={xMetric}
            yMetric={yMetric}
            colorOf={colorOf}
            connectedKeys={connectedKeys}
            hovered={hovered}
            onHover={setHovered}
          />
        ) : (
          <p className="py-16 text-center text-xs text-muted-foreground">
            None of the selected models have both numbers.
          </p>
        )}
        {hoveredEntry ? (
          <div className="pointer-events-none absolute top-2 right-2 rounded-lg border bg-popover px-2.5 py-1.5 text-2xs shadow-md">
            <div className="font-medium text-foreground">{hoveredEntry.name}</div>
            <div className="text-muted-foreground">
              {yMetric.label}:{" "}
              {formatBenchmarkValue(hoveredEntry.values[yMetric.key] ?? 0, yMetric)}
              {" · "}
              {xMetric.label}:{" "}
              {formatBenchmarkValue(hoveredEntry.values[xMetric.key] ?? 0, xMetric)}
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-2xs text-muted-foreground">
        Dotted line: the best score at each {xMetric.label.toLowerCase()}. Outlined dots are models
        you can run.
      </p>

      <div className="max-h-64 overflow-auto rounded-xl border border-border/60 [scrollbar-width:thin]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-2xs text-muted-foreground">
            <tr>
              {header("Model", "name", "left")}
              {header(yMetric.label, "y", "right")}
              {header(xMetric.label, "x", "right")}
              <th className="w-0" />
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const key = entry.sourceModelKey;
              const candidate = connected.get(key);
              const yValue = entry.values[yMetric.key];
              const xValue = entry.values[xMetric.key];
              return (
                <tr
                  key={key}
                  onPointerEnter={() => setHovered(key)}
                  onPointerLeave={() => setHovered(null)}
                  className={cn("border-t border-border/40", hovered === key && "bg-muted/50")}
                >
                  <td className="max-w-0 px-2 py-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: colorOf(entry) }}
                      />
                      <span className="truncate">{entry.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {yValue === undefined ? "–" : formatBenchmarkValue(yValue, yMetric)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {xValue === undefined ? "–" : formatBenchmarkValue(xValue, xMetric)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {candidate && onStartChat ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`New chat with ${entry.name}`}
                        onClick={() => {
                          onStartChat(candidate.selection);
                          onClose();
                        }}
                      >
                        New chat
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {source ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="self-end text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {source.attribution}
          {source.fetchedAt ? ` · updated ${formatRelativeTimeLabel(source.fetchedAt)}` : ""}
        </a>
      ) : null}
    </div>
  );
}

/** The mini benchmark explorer: scatter chart, filters and a sortable table over every model the source publishes. */
export function BenchmarkExplorer({
  open,
  onOpenChange,
  environmentId,
  candidates,
  onStartChat,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly environmentId: EnvironmentId;
  readonly candidates: ReadonlyArray<BenchmarkCandidate>;
  readonly onStartChat: ((selection: ModelSelection) => void) | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-4xl">
        <DialogPanel>
          <DialogTitle className="mb-3 text-base">Model benchmarks</DialogTitle>
          <ExplorerBody
            environmentId={environmentId}
            candidates={candidates}
            onStartChat={onStartChat}
            onClose={() => onOpenChange(false)}
          />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
