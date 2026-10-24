import { Link } from "@tanstack/react-router";
import { CalendarIcon } from "lucide-react";

import { WindowEmpty } from "../twoState/RailWindow";

/**
 * Calendar events for a surface, or the way to connect a calendar. `today` lists today's events
 * on the Today page. `upNext` lists the next few events on the Command Center card.
 */
export function CalendarAgenda({ variant }: { readonly variant: "today" | "upNext" }) {
  if (variant === "today") {
    return (
      <WindowEmpty
        icon={CalendarIcon}
        title="No calendar connected"
        line="Your events for today show here once a calendar is connected."
        action={{ label: "Connect a calendar", to: "/settings/integrations" }}
      />
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
        <Link
          to="/settings/integrations"
          className="mt-2 inline-block rounded-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Connect a calendar
        </Link>
      </div>
    </div>
  );
}
