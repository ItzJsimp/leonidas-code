import type { ScribeInsights } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import { useEnvironmentQuery } from "~/state/query";
import { scribeInsightsQuery } from "~/state/scribe";
import type { ScribeTabProps } from "./ScribePage";
import {
  Clip,
  EmptyNote,
  StatsPlaceholder,
  StatsSection,
  useRefreshOnDictation,
} from "./StatsParts";
import {
  STATS_INPUT,
  countRows,
  dayBars,
  formatCount,
  formatSeconds,
  hasNoStats,
  shortDate,
  waitChange,
  weekHeadline,
} from "./stats.logic";

export function ScribeInsightsTab({ environmentId, live }: ScribeTabProps) {
  const query = useEnvironmentQuery(scribeInsightsQuery({ environmentId, input: STATS_INPUT }));
  useRefreshOnDictation(`insights:${environmentId}`, live, query.refresh);
  const insights = query.data;
  if (insights === null) {
    return <StatsPlaceholder failed={query.error !== null} onRetry={query.refresh} />;
  }
  if (hasNoStats(insights)) {
    return (
      <EmptyNote title="Nothing to chart yet.">
        Insights fill in after your first dictation.
      </EmptyNote>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-[52ch] text-xl font-semibold text-balance">{weekHeadline(insights)}</p>
      <Figures insights={insights} />
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <StatsSection title="Words per day">
          <DayBars days={insights.weekly.days} />
        </StatsSection>
        <div className="flex flex-col gap-8">
          <WherePerf insights={insights} />
          <Apps insights={insights} />
        </div>
      </div>
      {insights.truncated ? (
        <p className="text-xs text-muted-foreground">Based on your latest 5,000 dictations.</p>
      ) : null}
    </div>
  );
}

function Figures({ insights }: { readonly insights: ScribeInsights }) {
  const wait = waitChange(insights.weekly.p50, insights.weekly.prevP50);
  const since = shortDate(insights.firstDay);
  const cells = [
    {
      label: "Today",
      value: `${formatCount(insights.todayWords)} words`,
      note: `${formatCount(insights.todayTranscripts)} dictations`,
    },
    {
      label: "Daily average",
      value: `${formatCount(insights.weekAvgWords)} words`,
      note: "over 7 days",
    },
    {
      label: "Typical wait",
      value: insights.latencySamples > 0 ? formatSeconds(insights.p50) : "No data yet",
      note: wait?.text ?? "",
      good: wait?.better ?? false,
    },
    {
      label: "All time",
      value: `${formatCount(insights.words)} words`,
      note: since ? `${formatCount(insights.daysActive)} days since ${since}` : "",
    },
  ];
  return (
    <dl className="grid grid-cols-2 divide-border border-y border-border sm:grid-cols-4 sm:divide-x">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col gap-0.5 py-3 sm:px-4 sm:first:pl-0">
          <dt className="text-sm text-muted-foreground">{cell.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{cell.value}</dd>
          <dd
            className={cn(
              "min-h-4 text-xs",
              "good" in cell && cell.good ? "text-success-foreground" : "text-muted-foreground",
            )}
          >
            {cell.note}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DayBars({ days }: { readonly days: ScribeInsights["weekly"]["days"] }) {
  const bars = dayBars(days);
  return (
    <ul
      aria-label="Words per day this week"
      className="grid h-44 grid-cols-7 items-end gap-2.5 sm:gap-3"
    >
      {bars.map((bar) => (
        <li key={bar.day} className="flex h-full flex-col items-center justify-end gap-1.5">
          {/* The day comes first in reading order and sits under its bar on screen. */}
          <span className="order-last text-xs text-muted-foreground">{bar.label}</span>
          <span className="text-xs tabular-nums">{formatCount(bar.words)}</span>
          <span
            aria-hidden
            className={cn(
              "w-full max-w-11 rounded-t-md rounded-b-sm",
              bar.busiest ? "bg-primary" : "bg-muted-foreground/70",
            )}
            style={{ height: `${bar.percent}%` }}
          />
        </li>
      ))}
    </ul>
  );
}

function WherePerf({ insights }: { readonly insights: ScribeInsights }) {
  if (insights.latencySamples === 0) {
    return (
      <StatsSection title="Where the time goes">
        <p className="text-sm text-muted-foreground">No timings saved yet.</p>
      </StatsSection>
    );
  }
  const stt = Math.round(insights.sttShare);
  return (
    <StatsSection title="Where the time goes">
      <p className="text-xs text-muted-foreground">
        Typical wait {formatSeconds(insights.p50)}, slowest 1 in 10 over{" "}
        {formatSeconds(insights.p90)}.
      </p>
      <div
        role="img"
        aria-label={`Hearing ${stt} percent, polish ${100 - stt} percent`}
        className="mt-1 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
      >
        <span className="bg-foreground" style={{ width: `${stt}%` }} />
        <span className="bg-primary" style={{ width: `${100 - stt}%` }} />
      </div>
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-foreground" />
          Hearing {formatSeconds(insights.sttP50)}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          Polish {formatSeconds(insights.polishP50)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Hearing turns your speech into text. Polish cleans up the words.
      </p>
    </StatsSection>
  );
}

function Apps({ insights }: { readonly insights: ScribeInsights }) {
  const rows = countRows(insights.byApp, 5);
  if (rows.length === 0) return null;
  return (
    <StatsSection title="Apps">
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-1.5 text-sm"
          >
            <Clip text={row.key} />
            <span className="text-muted-foreground tabular-nums">
              {formatCount(row.count)} dictations
            </span>
            <span
              aria-hidden
              className="col-span-2 h-1 overflow-hidden rounded-full bg-muted-foreground/20"
            >
              <span
                className="block h-full rounded-full bg-muted-foreground/70"
                style={{ width: `${row.percent}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </StatsSection>
  );
}
