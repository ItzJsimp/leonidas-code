import type { EnvironmentId, ModelSelection } from "@t3tools/contracts";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  benchmarkMetricGroup,
  benchmarkQueries,
  formatBenchmarkValue,
  rankBenchmarkCandidates,
  type BenchmarkCandidate,
  type BenchmarkMetricGroup,
  type BenchmarkTier,
} from "../../lib/modelBenchmarks";
import { cn } from "../../lib/utils";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Spinner } from "../ui/spinner";
import { Toggle, ToggleGroup } from "../ui/toggle-group";

const GROUPS: ReadonlyArray<{ readonly id: BenchmarkMetricGroup; readonly label: string }> = [
  { id: "score", label: "Score" },
  { id: "price", label: "Cost" },
  { id: "speed", label: "Speed" },
];

const TIER_BAR: Record<BenchmarkTier, string> = {
  top: "bg-success",
  upper: "bg-success/55",
  lower: "bg-warning/70",
  bottom: "bg-destructive/60",
};

/** Rows shown before "Show all"; the card is narrow and scrolls. */
const TOP_ROWS = 5;

/**
 * Connected models ranked on one public benchmark, as a section of the usage card.
 * The query runs only while the section is open; the server caches the source.
 */
function BenchmarkRows({
  environmentId,
  candidates,
  onStartChat,
}: {
  readonly environmentId: EnvironmentId;
  readonly candidates: ReadonlyArray<BenchmarkCandidate>;
  readonly onStartChat: ((selection: ModelSelection) => void) | null;
}) {
  const models = useMemo(() => benchmarkQueries(candidates), [candidates]);
  const { data, error, isPending } = useEnvironmentQuery(
    models.length === 0
      ? null
      : serverEnvironment.modelBenchmarks({ environmentId, input: { models } }),
  );
  const [group, setGroup] = useState<BenchmarkMetricGroup>("score");
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const source = data?.sources[0];
  const metrics = (data?.metrics ?? []).filter(
    (metric) => metric.source === source?.source && benchmarkMetricGroup(metric) === group,
  );
  const metric = metrics.find((entry) => entry.key === metricKey) ?? metrics[0];
  const ranked = useMemo(
    () => (data && metric ? rankBenchmarkCandidates(candidates, data, metric) : []),
    [candidates, data, metric],
  );

  if (!data) {
    return (
      <p className="flex items-center gap-2 text-2xs text-muted-foreground">
        {isPending ? (
          <>
            <Spinner className="size-3" /> Loading benchmarks
          </>
        ) : (
          (error ?? "Benchmarks are unavailable.")
        )}
      </p>
    );
  }

  const measured = ranked.filter((row) => row.value !== null);
  const shown = showAll ? measured : measured.slice(0, TOP_ROWS);

  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        aria-label="Metric"
        value={[group]}
        onValueChange={(next) => {
          const value = GROUPS.find((entry) => entry.id === next[0]);
          if (!value) return;
          setGroup(value.id);
          setMetricKey(null);
          setShowAll(false);
        }}
      >
        {GROUPS.map((entry) => (
          <Toggle key={entry.id} value={entry.id}>
            {entry.label}
          </Toggle>
        ))}
      </ToggleGroup>
      {metrics.length > 1 ? (
        <Select value={metric?.key ?? ""} onValueChange={(value) => setMetricKey(value)}>
          <SelectTrigger aria-label="Benchmark" size="xs" className="w-full">
            <SelectValue>{metric?.label}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {metrics.map((entry) => (
              <SelectItem key={entry.key} value={entry.key}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      ) : null}

      {metric && shown.length > 0 ? (
        <ol aria-label={`Connected models ranked by ${metric.label}`} className="flex flex-col">
          {shown.map((row, index) => {
            const { candidate } = row;
            const name = candidate.effortLabel
              ? `${candidate.modelName} · ${candidate.effortLabel}`
              : candidate.modelName;
            const body = (
              <>
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="w-4 shrink-0 text-2xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {formatBenchmarkValue(row.value ?? 0, metric)}
                  </span>
                </span>
                <span className="ml-5.5 flex h-1 rounded-full bg-muted/50">
                  {row.tier ? (
                    <span
                      aria-hidden
                      className={cn("h-full rounded-full", TIER_BAR[row.tier])}
                      style={{ width: `${Math.max(2, row.fraction * 100)}%` }}
                    />
                  ) : null}
                </span>
                <span className="ml-5.5 truncate text-2xs text-muted-foreground">
                  {candidate.providerName}
                  {candidate.effortLabel && !row.effortMeasured ? " · default run" : ""}
                </span>
              </>
            );
            return (
              <li key={candidate.key}>
                {onStartChat ? (
                  <button
                    type="button"
                    aria-label={`New chat with ${name}`}
                    title="Start a new chat with this model"
                    onClick={() => onStartChat(candidate.selection)}
                    className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex flex-col gap-0.5 px-1 py-1">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-2xs text-muted-foreground">
          {source?.state === "unavailable"
            ? "The source could not be reached. Try again later."
            : "No connected model has a result in this group."}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
        {measured.length > TOP_ROWS ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="cursor-pointer transition-colors hover:text-foreground"
          >
            {showAll ? "Show top 5" : `Show all ${measured.length}`}
          </button>
        ) : (
          <span />
        )}
        {source ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="truncate underline-offset-2 hover:text-foreground hover:underline"
          >
            {source.attribution}
            {source.fetchedAt ? ` · ${formatRelativeTimeLabel(source.fetchedAt)}` : ""}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Collapsed by default so the card stays short and the source is fetched only on demand. */
export function UsageBenchmarks({
  environmentId,
  candidates,
  onStartChat,
}: {
  readonly environmentId: EnvironmentId;
  readonly candidates: ReadonlyArray<BenchmarkCandidate>;
  readonly onStartChat: ((selection: ModelSelection) => void) | null;
}) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between text-xs font-medium"
      >
        Model benchmarks
        <ChevronDownIcon
          aria-hidden
          className={cn("size-3.5 text-muted-foreground", open && "rotate-180")}
        />
      </button>
      {open ? (
        <BenchmarkRows
          environmentId={environmentId}
          candidates={candidates}
          onStartChat={onStartChat}
        />
      ) : null}
    </div>
  );
}
