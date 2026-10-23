import { CalendarIcon, CheckIcon, CircleIcon, FileTextIcon, ListChecksIcon } from "lucide-react";

import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import { RailWindow, WindowEmpty, WindowError, type WindowTab } from "../../twoState/RailWindow";
import { useAiosHome } from "../../twoState/useTwoStateData";
import { prioritySummary, type PrioritySummary } from "./today.logic";

const TABS: readonly WindowTab[] = [
  { id: "priorities", label: "Priorities" },
  { id: "schedule", label: "Schedule" },
  { id: "briefing", label: "Briefing" },
];

const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** A still ring: the done share of today's priorities. */
function Ring({ summary }: { readonly summary: PrioritySummary }) {
  return (
    <svg viewBox="0 0 44 44" className="size-12 shrink-0 -rotate-90" aria-hidden>
      <circle
        cx="22"
        cy="22"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="4"
        className="stroke-border"
      />
      <circle
        cx="22"
        cy="22"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - summary.fraction)}
        className="stroke-foreground"
      />
    </svg>
  );
}

function Priorities() {
  const home = useAiosHome();
  if (home.data === null && home.error === null && !home.isPending) {
    return (
      <WindowEmpty
        icon={ListChecksIcon}
        title="No priorities today"
        line="Connect a workspace and your priorities for the day show here."
      />
    );
  }
  if (home.data === null && home.error === null) {
    return (
      <div role="status" aria-label="Loading your priorities" className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full" shape="card" />
        <Skeleton className="h-10 w-full" shape="card" />
        <Skeleton className="h-10 w-full" shape="card" />
      </div>
    );
  }
  if (home.data === null) {
    return (
      <WindowError
        message="Your priorities did not load. Check that Leonidas is running, then try again."
        onRetry={home.refresh}
      />
    );
  }
  const priorities = home.data.brief?.priorities ?? [];
  const summary = prioritySummary(priorities);
  if (summary.total === 0) {
    return (
      <WindowEmpty
        icon={ListChecksIcon}
        title="No priorities today"
        line="Today's brief has no priorities yet. They show here when it has."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Ring summary={summary} />
        <p className="text-sm font-medium" role="status">
          {summary.label}
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {priorities.map((priority) => (
          <li
            key={`${priority.title}|${priority.detail}`}
            className="flex items-start gap-3 px-4 py-3"
          >
            {priority.done ? (
              <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : (
              <CircleIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm",
                  priority.done && "text-muted-foreground line-through",
                )}
              >
                <span className="sr-only">{priority.done ? "Done: " : "Not done: "}</span>
                {priority.title}
              </span>
              {priority.detail ? (
                <span className="block text-xs text-muted-foreground">{priority.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The Today window: your priorities, your schedule and your briefing. */
export function TodayWindow() {
  return (
    <RailWindow title="Today" tabs={TABS}>
      {(tab) =>
        tab === "schedule" ? (
          <WindowEmpty
            icon={CalendarIcon}
            title="No calendar connected"
            line="Your events for today show here once a calendar is connected."
            action={{ label: "Connect a calendar", to: "/settings/integrations" }}
          />
        ) : tab === "briefing" ? (
          <WindowEmpty
            icon={FileTextIcon}
            title="No briefing yet"
            line="The daily briefing is not ready yet. It shows here each morning."
          />
        ) : (
          <Priorities />
        )
      }
    </RailWindow>
  );
}
