import type { CalendarSourceView } from "@t3tools/contracts";
import { CalendarPlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { toastManager } from "~/components/ui/toast";

import { SettingsSection } from "../settings/settingsLayout";
import { Tip } from "../twoState/Tip";
import { formatSynced } from "./calendar.logic";
import { ConnectCalendarDialog } from "./ConnectCalendarDialog";
import { bumpCalendars, useAgendaEvents, useCalendarCommands } from "./useCalendar";

/** Settings > Integrations > Calendars: what is connected, whether it syncs, and the way to add more. */
export function CalendarSettingsSection() {
  const query = useAgendaEvents(1);
  const commands = useCalendarCommands();
  const [connecting, setConnecting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const sources = query.data?.sources ?? [];

  const remove = async (source: CalendarSourceView) => {
    setRemoving(source.id);
    const result = await commands.remove(source.id);
    setRemoving(null);
    if (result.ok) bumpCalendars();
    else
      toastManager.add({
        type: "error",
        title: "Could not remove the calendar",
        description: result.message,
      });
  };

  return (
    <SettingsSection
      id="calendars"
      title="Calendars"
      headerAction={
        <Button size="xs" variant="outline" onClick={() => setConnecting(true)}>
          <CalendarPlusIcon aria-hidden /> Connect a calendar
        </Button>
      }
    >
      {query.data === null ? (
        query.error ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 px-3 py-3 text-sm sm:px-4"
          >
            <p className="text-muted-foreground">{query.error}</p>
            <Button size="xs" variant="outline" onClick={query.refresh}>
              Try again
            </Button>
          </div>
        ) : (
          <div role="status" aria-label="Loading" className="grid gap-2 px-3 py-3 sm:px-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        )
      ) : sources.length === 0 ? (
        <div className="px-3 py-3 text-sm sm:px-4">
          <p className="font-medium">No calendar connected</p>
          <p className="mt-0.5 text-muted-foreground">
            Connect Google Calendar, Outlook, Apple iCloud or any app that gives you a calendar
            link.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {sources.map((source) => {
            const synced = formatSynced(source.lastSyncAt);
            return (
              <li key={source.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: source.color }}
                />
                <span className="min-w-0 flex-1">
                  <Tip text={source.name}>
                    <span className="block truncate text-sm font-medium">{source.name}</span>
                  </Tip>
                  <span
                    className={
                      source.error
                        ? "block text-xs text-destructive-foreground"
                        : "block text-xs text-muted-foreground"
                    }
                  >
                    {source.error ??
                      [source.kind === "google" ? "Google" : "Link", synced ?? "Not read yet"].join(
                        " · ",
                      )}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {source.hint}
                </span>
                <Tip text={`Remove ${source.name}`}>
                  <Button
                    size="icon-xs"
                    variant="ghost-destructive"
                    aria-label={`Remove ${source.name}`}
                    disabled={removing === source.id}
                    onClick={() => void remove(source)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </Tip>
              </li>
            );
          })}
        </ul>
      )}
      <ConnectCalendarDialog open={connecting} onOpenChange={setConnecting} />
    </SettingsSection>
  );
}
