import type { CalendarEvent, CalendarEventsResult } from "@t3tools/contracts";
import { CalendarIcon, MapPinIcon, RefreshCwIcon, VideoIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import { WindowError, WindowLoading } from "../twoState/RailWindow";
import { Tip } from "../twoState/Tip";
import { dayLabel, eventsOnDay, timeLabel, timeRangeLabel, upcomingEvents } from "./calendar.logic";
import { ConnectCalendarDialog } from "./ConnectCalendarDialog";
import { useAgendaEvents } from "./useCalendar";

const UP_NEXT_ROWS = 3;

/**
 * Calendar events for a surface, or the way to connect a calendar. `today` lists today's events
 * on the Today page. `upNext` lists the next few events of the week on the Command Center card.
 */
export function CalendarAgenda({ variant }: { readonly variant: "today" | "upNext" }) {
  const query = useAgendaEvents(variant === "today" ? 1 : 7);
  const [connecting, setConnecting] = useState(false);
  const compact = variant === "upNext";
  const data = query.data;
  const dialog = <ConnectCalendarDialog open={connecting} onOpenChange={setConnecting} />;

  let body;
  if (data === null) {
    body = query.error ? (
      <AgendaError compact={compact} message={query.error} onRetry={query.refresh} />
    ) : compact ? (
      <div role="status" aria-label="Loading" className="grid gap-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className={cn("h-4", row === 1 ? "w-3/5" : "w-4/5")} />
        ))}
      </div>
    ) : (
      <WindowLoading label="Loading your calendar" />
    );
  } else if (data.sources.length === 0) {
    body = <NotConnected compact={compact} onConnect={() => setConnecting(true)} />;
  } else {
    body = (
      <Agenda
        compact={compact}
        data={data}
        now={query.now}
        onRetry={query.refresh}
        refreshing={query.isPending}
      />
    );
  }
  return (
    <>
      {body}
      {dialog}
    </>
  );
}

function NotConnected({
  compact,
  onConnect,
}: {
  readonly compact: boolean;
  readonly onConnect: () => void;
}) {
  if (!compact) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <CalendarIcon aria-hidden className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No calendar connected</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your events for today show here once a calendar is connected.
        </p>
        <Button size="sm" onClick={onConnect}>
          Connect a calendar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
      <CalendarIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">No calendar connected</p>
        <p className="mt-0.5 text-muted-foreground">
          Connect a calendar and your next meetings show here.
        </p>
        <Button size="xs" variant="outline" className="mt-2" onClick={onConnect}>
          Connect a calendar
        </Button>
      </div>
    </div>
  );
}

function AgendaError({
  compact,
  message,
  onRetry,
}: {
  readonly compact: boolean;
  readonly message: string;
  readonly onRetry: () => void;
}) {
  if (!compact) return <WindowError message={message} onRetry={onRetry} />;
  return (
    <div role="alert" className="grid justify-items-start gap-2 text-sm">
      <p className="text-muted-foreground">{message}</p>
      <Button size="xs" variant="outline" onClick={onRetry}>
        <RefreshCwIcon aria-hidden /> Try again
      </Button>
    </div>
  );
}

function Agenda({
  compact,
  data,
  now,
  onRetry,
  refreshing,
}: {
  readonly compact: boolean;
  readonly data: CalendarEventsResult;
  readonly now: number;
  readonly onRetry: () => void;
  readonly refreshing: boolean;
}) {
  const colors = new Map(data.sources.map((source) => [source.id, source.color]));
  const failing = data.sources.filter((source) => source.error);
  const events = compact
    ? upcomingEvents(data.events, now, UP_NEXT_ROWS)
    : eventsOnDay(data.events, now);

  // Every calendar failed and nothing is cached: say why, with the way to retry.
  if (events.length === 0 && failing.length === data.sources.length) {
    return (
      <AgendaError
        compact={compact}
        message={failing[0]?.error ?? "Your calendar did not load."}
        onRetry={onRetry}
      />
    );
  }
  const warning =
    failing.length > 0 ? (
      <p role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {failing.length === 1
          ? `${failing[0]?.name ?? "A calendar"} did not sync: ${failing[0]?.error ?? ""}`
          : `${failing.length} calendars did not sync.`}
        <Button size="xs" variant="ghost-muted" onClick={onRetry} disabled={refreshing}>
          Try again
        </Button>
      </p>
    ) : null;

  if (events.length === 0) {
    return (
      <div className="grid gap-2">
        <p className={cn("text-sm text-muted-foreground", !compact && "py-8 text-center")}>
          {compact ? "Nothing coming up this week" : "Nothing on your calendar today"}
        </p>
        {warning}
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <ul className={cn("divide-y divide-border/60", compact ? "-my-2" : "-my-1")}>
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            color={colors.get(event.sourceId) ?? "#5f6368"}
            compact={compact}
            now={now}
          />
        ))}
      </ul>
      {warning}
    </div>
  );
}

function EventRow({
  event,
  color,
  compact,
  now,
}: {
  readonly event: CalendarEvent;
  readonly color: string;
  readonly compact: boolean;
  readonly now: number;
}) {
  const over = Date.parse(event.end) <= now && !event.allDay;
  return (
    <li className={cn("flex min-w-0 items-start gap-3 py-2", over && "opacity-60")}>
      <span
        className={cn(
          "shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground",
          compact ? "w-20" : "w-24",
        )}
      >
        {compact ? (
          <>
            <span className="block">{dayLabel(event, now)}</span>
            <span className="block">{timeLabel(event)}</span>
          </>
        ) : (
          <span className="block">{timeRangeLabel(event)}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <Tip text={event.title}>
            <span className="min-w-0 truncate">{event.title}</span>
          </Tip>
        </span>
        {event.location && !compact ? (
          <Tip text={event.location}>
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon aria-hidden className="size-3 shrink-0" />
              <span className="min-w-0 truncate">{event.location}</span>
            </span>
          </Tip>
        ) : null}
      </span>
      {event.joinUrl ? (
        <a
          href={event.joinUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Join ${event.title}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          <VideoIcon aria-hidden className="size-3" />
          Join
        </a>
      ) : null}
    </li>
  );
}
