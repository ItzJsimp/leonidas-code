import type { FoldedFeedEvent } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { feedEventOpenTarget, openFeedEvent } from "~/eventFeedOpen";
import { useEventFeedStore } from "~/eventFeedStore";

import { changedLabel } from "../twoState/areaRows";
import { plainEventBody, plainEventTitle } from "../twoState/eventText";
import { useAiosHome, useFeedStatus } from "../twoState/useTwoStateData";
import { HalfGauge, ProgressBar } from "./charts";
import { eventsToday, goalPercent } from "./commandCenter.logic";
import { HomeWidget, WidgetEmpty, WidgetError, WidgetList, WidgetSkeleton } from "./HomeWidget";
import { useGoals, useNowMs } from "./useHomeReads";

const RECENT = 5;

/** The latest five feed events, and how many events happened today. */
export function RecentActivityWidget() {
  const feed = useFeedStatus();
  const markRead = useEventFeedStore((store) => store.markRead);
  const { environmentId } = useActiveAiosWorkspace();
  const navigate = useNavigate();
  const now = useNowMs();
  const today = useMemo(() => eventsToday(feed.events, now), [feed.events, now]);

  const open = (event: FoldedFeedEvent) => {
    if (!environmentId) return;
    markRead([event.id]);
    openFeedEvent(event, environmentId, navigate);
  };

  return (
    <HomeWidget title="Recent activity" count={`latest ${RECENT}`}>
      {feed.error !== null && !feed.loaded ? (
        <WidgetError message="The activity could not be read." onRetry={feed.refresh} />
      ) : !feed.loaded ? (
        <WidgetSkeleton />
      ) : feed.events.length === 0 ? (
        <WidgetEmpty>No activity yet. Agents, scripts and the app write here.</WidgetEmpty>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Events today</p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-display text-2xl leading-none font-semibold tabular-nums">
                {today}
              </span>
              <span className="text-sm text-muted-foreground">
                {today === 1 ? "event" : "events"}
              </span>
            </p>
          </div>
          <WidgetList>
            {feed.events.slice(0, RECENT).map((event) => {
              const body = plainEventBody(event.body);
              const opens = feedEventOpenTarget(event) !== null;
              const title = (
                <span className="block text-sm font-semibold wrap-anywhere">
                  {plainEventTitle(event.title)}
                  {event.count > 1 ? (
                    <span className="font-normal text-muted-foreground"> ({event.count})</span>
                  ) : null}
                </span>
              );
              return (
                <li key={event.id} className="flex min-w-0 items-start gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    {opens ? (
                      <button
                        type="button"
                        onClick={() => open(event)}
                        className="block w-full rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {title}
                      </button>
                    ) : (
                      title
                    )}
                    {body ? (
                      <span
                        title={body}
                        className="line-clamp-2 text-xs wrap-anywhere text-muted-foreground"
                      >
                        {body}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {changedLabel(Date.parse(event.ts), now)}
                  </span>
                </li>
              );
            })}
          </WidgetList>
        </div>
      )}
    </HomeWidget>
  );
}

/** Goals from the AIOS folder. A gauge shows only when a goal's status states a real percent. */
export function GoalsWidget() {
  const { data, error, refresh } = useGoals();
  const focus = useAiosHome().data?.move.title;
  const goals = data?.goals ?? [];
  const gauge = goals[0] ? goalPercent(goals[0].status) : null;
  const rest = gauge === null ? goals : goals.slice(1);

  return (
    <HomeWidget
      title="Goal progress"
      count={data === null ? undefined : `${goals.length} ${goals.length === 1 ? "goal" : "goals"}`}
    >
      {data === null ? (
        error !== null ? (
          <WidgetError message="Your goals could not be read." onRetry={refresh} />
        ) : (
          <WidgetSkeleton />
        )
      ) : goals.length === 0 ? (
        <WidgetEmpty>
          {data.root === null
            ? "No AIOS folder connected yet."
            : "Your AIOS has no goals yet. A 10-minute planning chat sets them."}
        </WidgetEmpty>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {focus ? (
            <p className="text-sm wrap-anywhere">
              <span className="text-muted-foreground">Focus: </span>
              {focus}
            </p>
          ) : null}
          {gauge !== null && goals[0] ? (
            <div className="flex items-center gap-4">
              <HalfGauge percent={gauge} label={`${goals[0].goal}: ${gauge} percent`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold wrap-anywhere">{goals[0].goal}</p>
                <p className="text-xs wrap-anywhere text-muted-foreground">
                  {[goals[0].status, goals[0].targetDate && `due ${goals[0].targetDate}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          ) : null}
          {rest.length > 0 ? (
            <WidgetList>
              {rest.map((goal) => {
                const percent = goalPercent(goal.status);
                return (
                  <li key={goal.id} className="grid min-w-0 grid-cols-1 gap-1.5 py-2">
                    <p className="text-sm font-semibold wrap-anywhere">{goal.goal}</p>
                    {percent !== null ? (
                      <ProgressBar percent={percent} label={`${goal.goal}: ${percent} percent`} />
                    ) : null}
                    <p className="text-xs wrap-anywhere text-muted-foreground">
                      {[goal.status, goal.targetDate && `due ${goal.targetDate}`]
                        .filter(Boolean)
                        .join(" · ") || "No status yet"}
                    </p>
                  </li>
                );
              })}
            </WidgetList>
          ) : null}
        </div>
      )}
    </HomeWidget>
  );
}
