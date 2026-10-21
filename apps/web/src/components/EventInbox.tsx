import type { FoldedFeedEvent } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import {
  BellIcon,
  BellOffIcon,
  CircleAlertIcon,
  CircleDotIcon,
  InfoIcon,
  XIcon,
} from "lucide-react";
import { useMemo } from "react";

import { feedEventOpenTarget, openFeedEvent } from "../eventFeedOpen";
import { useEventFeedStore } from "../eventFeedStore";
import { cn } from "../lib/utils";
import { eventFeedLive } from "../state/eventFeed";
import { useEnvironmentQuery } from "../state/query";
import { formatRelativeTimeLabel } from "../timestampFormat";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "./ui/popover";
import { useActiveAiosWorkspace } from "./workspace/useActiveAiosWorkspace";

const LEVEL_ICON = {
  failed: <CircleAlertIcon aria-hidden className="size-4 text-destructive-foreground" />,
  needs_you: <CircleDotIcon aria-hidden className="size-4 text-warning-foreground" />,
  info: <InfoIcon aria-hidden className="size-4 text-muted-foreground" />,
} as const;

const LEVEL_LABEL = { failed: "Failed", needs_you: "Needs you", info: "Info" } as const;

/** The bell and inbox: every event from the active workspace's feed, newest first. */
export function EventInbox() {
  const workspace = useActiveAiosWorkspace();
  const environmentId = workspace.environmentId;
  const feed = useEnvironmentQuery(
    environmentId && workspace.scopeReady
      ? eventFeedLive({ environmentId, input: workspace.scope })
      : null,
  );
  const marks = useEventFeedStore((store) => store.marks);
  const mutedTypes = useEventFeedStore((store) => store.mutedTypes);
  const markRead = useEventFeedStore((store) => store.markRead);
  const dismiss = useEventFeedStore((store) => store.dismiss);
  const toggleMuted = useEventFeedStore((store) => store.toggleMuted);
  const navigate = useNavigate();

  const events = useMemo(
    () => (feed.data?.events ?? []).filter((event) => !marks[event.id]?.dismissed),
    [feed.data, marks],
  );
  const unread = events.filter((event) => !marks[event.id]?.read);
  const bad = feed.data?.bad ?? [];
  if (!environmentId) return null;

  const open = (event: FoldedFeedEvent) => {
    markRead([event.id]);
    openFeedEvent(event, environmentId, navigate);
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={
              unread.length > 0 ? `Notifications, ${unread.length} unread` : "Notifications"
            }
            className="relative"
          />
        }
      >
        <BellIcon />
        {unread.length > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-3xs leading-4 font-medium text-primary-foreground tabular-nums"
          >
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-[min(26rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <PopoverTitle>Inbox</PopoverTitle>
          <Button
            size="xs"
            variant="ghost-muted"
            disabled={unread.length === 0}
            onClick={() => markRead(unread.map((event) => event.id))}
          >
            Mark all read
          </Button>
        </div>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing here yet. Agents, scripts and the app post events here.
          </p>
        ) : (
          <ul className="max-h-[min(28rem,60dvh)] divide-y divide-border overflow-y-auto">
            {events.map((event) => {
              const isRead = marks[event.id]?.read === true;
              const muted = mutedTypes.includes(event.type);
              const canOpen = feedEventOpenTarget(event) !== null;
              return (
                <li key={event.id} className="group flex items-start gap-2 py-2">
                  <span className="mt-0.5">
                    {LEVEL_ICON[event.level]}
                    <span className="sr-only">{LEVEL_LABEL[event.level]}.</span>
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                    onClick={() => (canOpen ? open(event) : markRead([event.id]))}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-sm",
                          isRead ? "text-muted-foreground" : "font-medium",
                        )}
                      >
                        {event.title}
                      </span>
                      {event.count > 1 ? <Badge variant="secondary">{event.count}x</Badge> : null}
                      {isRead ? null : <span className="sr-only">Unread.</span>}
                    </span>
                    {event.body ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {event.body}
                      </span>
                    ) : null}
                    {event.target?.files && event.target.files.length > 0 ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {event.target.files.join(", ")}
                      </span>
                    ) : null}
                    <span className="text-2xs text-muted-foreground">
                      {event.actor.name} · {formatRelativeTimeLabel(event.ts)}
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <Button
                      size="icon-xs"
                      variant="ghost-muted"
                      aria-label={muted ? `Unmute ${event.type}` : `Mute ${event.type} pop-ups`}
                      onClick={() => toggleMuted(event.type)}
                    >
                      {muted ? <BellIcon /> : <BellOffIcon />}
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost-muted"
                      aria-label={`Dismiss ${event.title}`}
                      onClick={() => dismiss(event.id)}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {bad.length > 0 ? (
          <p className="border-t border-border pt-2 text-xs text-warning-foreground">
            Skipped {bad.length} unreadable {bad.length === 1 ? "line" : "lines"} in the event
            files. First: {bad[0]!.file.split(/[\\/]/).pop()} line {bad[0]!.line}.
          </p>
        ) : null}
      </PopoverPopup>
    </Popover>
  );
}
