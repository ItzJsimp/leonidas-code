import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { cn } from "~/lib/utils";

import { areaRow } from "../twoState/areaRows";
import { PriorityChecklist } from "../windows/today/PriorityChecklist";
import { usePriorities } from "../windows/today/usePriorities";
import { Tip } from "../twoState/Tip";
import { useAiosHome } from "../twoState/useTwoStateData";
import { DoneBars, Ring, SegmentBar, toneClass } from "./charts";
import { areaBars, doneSeries, ringPercent, statusSegments } from "./commandCenter.logic";
import { HomeWidget, WidgetEmpty, WidgetError, WidgetSkeleton } from "./HomeWidget";
import { useNowMs, useTaskCards } from "./useHomeReads";

/** A label over a number: the number-first block inside a widget. */
function Stat({
  label,
  value,
  unit,
  tip,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly unit?: string;
  readonly tip: string;
}) {
  return (
    <Tip text={tip}>
      <div
        tabIndex={0}
        className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
      >
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-display text-2xl leading-none font-semibold tabular-nums">
            {value}
          </span>
          {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        </p>
      </div>
    </Tip>
  );
}

/** A widget body that reads the AIOS home: error with Try again, then skeleton, then content. */
function HomeBody({
  children,
  rows,
}: {
  readonly children: (home: NonNullable<ReturnType<typeof useAiosHome>["data"]>) => ReactNode;
  readonly rows?: number;
}) {
  const { data, error, refresh } = useAiosHome();
  if (data === null && error !== null) {
    return <WidgetError message="Your AIOS folder could not be read." onRetry={refresh} />;
  }
  if (data === null) return <WidgetSkeleton rows={rows ?? 3} />;
  return children(data);
}

/** Today's priorities from the daily brief: a 4 px ring (done of all) and one tick box each. */
export function PrioritiesWidget() {
  const { priorities, toggle } = usePriorities();
  return (
    <HomeWidget title="Today's priorities">
      <HomeBody>
        {() => {
          const done = priorities.filter((priority) => priority.done).length;
          const percent = ringPercent(done, priorities.length);
          if (percent === null) {
            return (
              <WidgetEmpty>
                No priorities for today.{" "}
                <Link
                  to="/today"
                  className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Plan today
                </Link>
              </WidgetEmpty>
            );
          }
          return (
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Ring percent={percent} label={`${done} of ${priorities.length} done today`}>
                  {`${done}/${priorities.length}`}
                </Ring>
                <Stat
                  label="Done today"
                  value={done}
                  unit={`of ${priorities.length}`}
                  tip="Priorities ticked in today's daily brief, out of all priorities in it."
                />
              </div>
              <PriorityChecklist
                dense
                priorities={priorities}
                onToggle={(priority) => void toggle(priority)}
              />
            </div>
          );
        }}
      </HomeBody>
    </HomeWidget>
  );
}

/** Open task cards by status: the total, one segmented bar and a legend with numbers. */
export function OpenTasksWidget() {
  return (
    <HomeWidget title="Open tasks" count="by status">
      <HomeBody>
        {(home) => {
          const { total, segments, legend } = statusSegments(home.counts);
          if (total === 0) return <WidgetEmpty>No open tasks.</WidgetEmpty>;
          return (
            <div className="grid gap-3">
              <Stat
                label="Open now"
                value={total.toLocaleString("en-US")}
                unit={total === 1 ? "task" : "tasks"}
                tip="Task cards that are To do, In progress, In review or Blocked."
              />
              <SegmentBar
                segments={segments}
                label={`${total.toLocaleString("en-US")} open tasks by status`}
              />
              <ul className="grid gap-1.5 text-sm">
                {legend.map((row) => (
                  <li key={row.key} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn("size-2 shrink-0 rounded-xs", toneClass(row.tone))}
                    />
                    <span className="min-w-0 flex-1 text-muted-foreground">{row.label}</span>
                    <span className="font-medium tabular-nums">
                      {row.value.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }}
      </HomeBody>
    </HomeWidget>
  );
}

/** Memory by area: the total and one horizontal bar per area, biggest first. */
export function MemoryWidget() {
  const now = useNowMs();
  return (
    <HomeWidget title="Memory" count="by area">
      <HomeBody rows={5}>
        {(home) => {
          const areas = home.areas ?? [];
          const { total, bars } = areaBars(areas);
          if (bars.length === 0) return <WidgetEmpty>No AIOS folder connected yet.</WidgetEmpty>;
          const byId = new Map(areas.map((area) => [area.id, area]));
          return (
            <div className="grid gap-3">
              <Stat
                label="In your AIOS"
                value={total.toLocaleString("en-US")}
                unit={total === 1 ? "item" : "items"}
                tip="Cards, notes, decisions, logs, skills and pages, added up across every area."
              />
              <ul className="grid gap-2 text-sm">
                {bars.map((bar) => {
                  const area = byId.get(bar.id);
                  const detail = area ? areaRow(area, now).detail : bar.label;
                  return (
                    <Tip key={bar.id} text={detail}>
                      <li className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2">
                        <span className="truncate text-muted-foreground">{bar.label}</span>
                        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-muted-foreground/60"
                            style={{ width: `${bar.widthPercent}%` }}
                          />
                        </span>
                        <span className="text-right font-medium tabular-nums">
                          {bar.units.toLocaleString("en-US")}
                        </span>
                      </li>
                    </Tip>
                  );
                })}
              </ul>
            </div>
          );
        }}
      </HomeBody>
    </HomeWidget>
  );
}

/** Tasks finished per day over 14 days, from the done date on each task card. */
export function DonePerDayWidget() {
  const { data, error, refresh } = useTaskCards();
  const now = useNowMs();
  const series = useMemo(() => (data ? doneSeries(data.tasks, now) : null), [data, now]);

  return (
    <HomeWidget title="Tasks done per day" count="last 14 days">
      {series === null ? (
        error !== null ? (
          <WidgetError message="Your task cards could not be read." onRetry={refresh} />
        ) : (
          <WidgetSkeleton rows={4} />
        )
      ) : series.total === 0 ? (
        <WidgetEmpty>No task was finished in the last 14 days.</WidgetEmpty>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Done today"
              value={series.today}
              unit={series.today === 1 ? "task" : "tasks"}
              tip="Task cards moved to done today."
            />
            <Stat
              label="In 14 days"
              value={series.total}
              unit={series.total === 1 ? "task" : "tasks"}
              tip="Task cards done in the last 14 days. A card with no done date counts on the day its file last changed."
            />
            <Stat
              label="Daily average"
              value={series.average}
              unit="tasks"
              tip="Tasks done in the last 14 days, divided by 14."
            />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {series.week === series.weekBefore ? (
              <MinusIcon aria-hidden className="size-3" />
            ) : series.week > series.weekBefore ? (
              <ArrowUpIcon aria-hidden className="size-3" />
            ) : (
              <ArrowDownIcon aria-hidden className="size-3" />
            )}
            <span>
              <span className="font-semibold text-foreground">{series.week}</span> finished in the
              last 7 days. {series.change}.
            </span>
          </p>
          <DoneBars days={series.days} average={series.average} />
          <p className="text-xs text-muted-foreground">
            {series.days[0]?.short} to {series.days.at(-1)?.short}. The dashed line is the daily
            average, {series.average}.
          </p>
        </div>
      )}
    </HomeWidget>
  );
}
