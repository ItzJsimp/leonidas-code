import type { EnvironmentId, ModelSelection } from "@t3tools/contracts";
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
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Spinner } from "../ui/spinner";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

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

/**
 * Connected models ranked on one public benchmark. The server fetches and
 * caches the source, so this renders the same on local and remote clients.
 */
export function ModelBenchmarksPanel({
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
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [group, setGroup] = useState<BenchmarkMetricGroup>("score");
  const [metricKey, setMetricKey] = useState<string | null>(null);

  const source = data?.sources.find((entry) => entry.source === sourceId) ?? data?.sources[0];
  const metrics = (data?.metrics ?? []).filter(
    (metric) => metric.source === source?.source && benchmarkMetricGroup(metric) === group,
  );
  const metric = metrics.find((entry) => entry.key === metricKey) ?? metrics[0];
  const ranked = data && metric ? rankBenchmarkCandidates(candidates, data, metric) : [];

  if (candidates.length === 0) {
    return <PanelNote>No connected models to compare yet.</PanelNote>;
  }
  if (!data) {
    return isPending ? (
      <PanelNote>
        <Spinner className="size-3.5" /> Loading benchmarks
      </PanelNote>
    ) : (
      <PanelNote>{error ?? "Benchmarks are unavailable."}</PanelNote>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {data.sources.length > 1 ? (
          <Select
            value={source?.source ?? ""}
            onValueChange={(value) => {
              setSourceId(value);
              setMetricKey(null);
            }}
          >
            <SelectTrigger aria-label="Benchmark source" size="xs">
              <SelectValue>{source?.attribution}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {data.sources.map((entry) => (
                <SelectItem key={entry.source} value={entry.source}>
                  {entry.attribution}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null}
        <ToggleGroup
          aria-label="Metric"
          value={[group]}
          onValueChange={(next) => {
            const value = GROUPS.find((entry) => entry.id === next[0]);
            if (!value) return;
            setGroup(value.id);
            setMetricKey(null);
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
            <SelectTrigger aria-label="Benchmark" size="xs" className="min-w-0 max-w-56">
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
      </div>

      {metric ? (
        <ol
          aria-label={`Connected models ranked by ${metric.label}`}
          className="flex min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]"
        >
          {ranked.map((row) => (
            <li key={row.candidate.key} className="group/row flex items-center gap-2 text-xs">
              <div className="flex w-40 min-w-0 shrink-0 flex-col">
                <span className="truncate font-medium text-foreground">
                  {row.candidate.modelName}
                  {row.candidate.effortLabel ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {row.candidate.effortLabel}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-2xs text-muted-foreground">
                  {row.candidate.providerName}
                </span>
              </div>
              <div className="relative h-4 min-w-0 flex-1 rounded-sm bg-muted/40">
                {row.tier ? (
                  <div
                    aria-hidden
                    className={cn("h-full rounded-sm", TIER_BAR[row.tier])}
                    style={{ width: `${Math.max(2, row.fraction * 100)}%` }}
                  />
                ) : null}
              </div>
              <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                {row.value === null ? (
                  "not measured"
                ) : (
                  <>
                    <span className="text-foreground">
                      {formatBenchmarkValue(row.value, metric)}
                    </span>
                    {row.candidate.effortLabel && !row.effortMeasured ? (
                      <Tooltip>
                        <TooltipTrigger render={<span className="block text-2xs" />}>
                          effort not measured
                        </TooltipTrigger>
                        <TooltipPopup side="top">
                          The source has no result for this effort; this is the model's default run.
                        </TooltipPopup>
                      </Tooltip>
                    ) : null}
                  </>
                )}
              </span>
              {onStartChat ? (
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label={`New chat with ${row.candidate.modelName}${row.candidate.effortLabel ? ` (${row.candidate.effortLabel})` : ""}`}
                  onClick={() => onStartChat(row.candidate.selection)}
                >
                  New chat
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <PanelNote>
          {source?.state === "unavailable"
            ? "The source could not be reached. Try again later."
            : "No connected model has a result in this group."}
        </PanelNote>
      )}

      {source ? (
        <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            {source.attribution}
          </a>
          {source.fetchedAt ? (
            <span>updated {formatRelativeTimeLabel(source.fetchedAt)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PanelNote({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
