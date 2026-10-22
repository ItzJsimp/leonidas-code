import type { FoldedFeedEvent } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Button } from "~/components/ui/button";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { feedEventOpenTarget, openFeedEvent } from "~/eventFeedOpen";
import { useEventFeedStore } from "~/eventFeedStore";
import { useNowMinute } from "~/hooks/useNowMinute";
import { cn } from "~/lib/utils";

import { changedLabel } from "./areaRows";
import { RailEmpty, RailList, RailPanel, RailRow } from "./RailParts";
import { actionLabel, splitFeed } from "./railFeed";
import { RailSlotSections } from "./SlotOutlet";
import { useFeedEvents } from "./useTwoStateData";

const LEVEL_TEXT = { needs_you: "Needs you", failed: "Failed", info: "Info" } as const;

/** Needs you, then Activity (the feed without the Needs you items), then plug-in sections. */
export function RightRail() {
  const events = useFeedEvents();
  const marks = useEventFeedStore((store) => store.marks);
  const markRead = useEventFeedStore((store) => store.markRead);
  const { environmentId } = useActiveAiosWorkspace();
  const navigate = useNavigate();
  const now = Date.parse(`${useNowMinute()}Z`);
  const { needsYou, activity } = useMemo(() => splitFeed(events, marks), [events, marks]);

  const open = (event: FoldedFeedEvent) => {
    if (!environmentId) return;
    markRead([event.id]);
    openFeedEvent(event, environmentId, navigate);
  };
  const when = (event: FoldedFeedEvent) => changedLabel(Date.parse(event.ts), now);

  return (
    <>
      <RailPanel title="Needs you" count={needsYou.length}>
        {needsYou.length === 0 ? (
          <RailEmpty>Nothing needs you.</RailEmpty>
        ) : (
          <RailList>
            {needsYou.map((event) => {
              const label = actionLabel(event);
              return (
                <RailRow key={event.id}>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      event.level === "failed" ? "bg-destructive" : "bg-warning",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">{LEVEL_TEXT[event.level]}: </span>
                    <span className="block font-medium">{event.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {when(event)}
                      {event.body ? ` · ${event.body}` : null}
                    </span>
                  </span>
                  {label !== null ? (
                    <Button size="xs" variant="outline" onClick={() => open(event)}>
                      {label}
                    </Button>
                  ) : null}
                </RailRow>
              );
            })}
          </RailList>
        )}
      </RailPanel>
      <RailPanel title="Activity">
        {activity.length === 0 ? (
          <RailEmpty>No activity yet. Agents, scripts and the app write here.</RailEmpty>
        ) : (
          <RailList>
            {activity.map((event) => {
              const opens = feedEventOpenTarget(event) !== null;
              const body = (
                <>
                  <span className="block truncate font-medium">
                    {event.title}
                    {event.count > 1 ? (
                      <span className="text-muted-foreground"> ({event.count})</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {when(event)}
                    {event.body ? ` · ${event.body}` : null}
                  </span>
                </>
              );
              return (
                <RailRow key={event.id}>
                  {opens ? (
                    <button
                      type="button"
                      onClick={() => open(event)}
                      className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      {body}
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1">{body}</span>
                  )}
                </RailRow>
              );
            })}
          </RailList>
        )}
      </RailPanel>
      <RailSlotSections slot="rightRail" />
    </>
  );
}
