import { useMemo } from "react";
import {
  BookOpenIcon,
  BrainIcon,
  CheckIcon,
  FileTextIcon,
  FolderIcon,
  ListIcon,
  type LucideIcon,
  ScaleIcon,
  SquareCheckIcon,
  ZapIcon,
} from "lucide-react";

import { useNowMinute } from "~/hooks/useNowMinute";
import { cn } from "~/lib/utils";

import { areaRow } from "./areaRows";
import { useCodeForward } from "./codeForwardContext";
import { touchedFromFeed, withTouched } from "./liveArea";
import { RailEmpty, RailList, RailPanel, RailRow } from "./RailParts";
import { RailSlotSections } from "./SlotOutlet";
import { useAiosHome, useFeedEvents } from "./useTwoStateData";

const AREA_ICONS: Record<string, LucideIcon> = {
  tasks: SquareCheckIcon,
  projects: FolderIcon,
  decisions: ScaleIcon,
  memory: BrainIcon,
  logs: ListIcon,
  skills: ZapIcon,
  wiki: BookOpenIcon,
};

/** Your AIOS, then today's priorities, then plug-in sections. */
export function LeftRail() {
  return (
    <>
      <YourAios />
      <TodayPriorities />
      <RailSlotSections slot="leftRail" />
    </>
  );
}

function YourAios() {
  const home = useAiosHome().data;
  const events = useFeedEvents();
  const touchedAt = useMemo(() => touchedFromFeed(events), [events]);
  const { live } = useCodeForward();
  const areas = withTouched(home?.areas ?? [], touchedAt);
  // The minute clock keeps "12 min ago" true without a timer per row.
  const now = Date.parse(`${useNowMinute()}Z`);
  return (
    <RailPanel title="Your AIOS">
      {home === null ? (
        <RailEmpty>Reading your AIOS folder...</RailEmpty>
      ) : areas.length === 0 ? (
        <RailEmpty>No AIOS folder connected yet.</RailEmpty>
      ) : (
        <RailList>
          {areas.map((area) => {
            const row = areaRow(area, now);
            const Icon = AREA_ICONS[area.id] ?? FileTextIcon;
            const isLive = live.area === area.id;
            return (
              <RailRow key={row.id} raised={isLive} className="items-center">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-md",
                    isLive ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" title={row.label}>
                    {row.label}
                  </span>
                  {isLive && live.path !== null ? (
                    <span className="block truncate font-mono text-xs text-foreground">
                      {live.path}
                    </span>
                  ) : (
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.detail}
                    </span>
                  )}
                </span>
              </RailRow>
            );
          })}
        </RailList>
      )}
    </RailPanel>
  );
}

function TodayPriorities() {
  const priorities = useAiosHome().data?.brief?.priorities;
  const done = priorities?.filter((priority) => priority.done).length ?? 0;
  return (
    <RailPanel
      title="Today"
      count={
        priorities && priorities.length > 0 ? `${done} of ${priorities.length} done` : undefined
      }
    >
      {!priorities || priorities.length === 0 ? (
        <RailEmpty>No priorities for today. The daily brief sets them.</RailEmpty>
      ) : (
        <RailList>
          {priorities.map((priority) => (
            <RailRow key={priority.title}>
              <span
                aria-hidden
                className={cn(
                  "mt-px grid size-5 shrink-0 place-items-center rounded-md border-2",
                  priority.done ? "border-muted bg-muted text-muted-foreground" : "border-border",
                )}
              >
                {priority.done ? <CheckIcon className="size-3" /> : null}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 font-medium",
                  priority.done && "text-muted-foreground line-through",
                )}
              >
                <span className="sr-only">{priority.done ? "Done: " : "To do: "}</span>
                {priority.title}
              </span>
            </RailRow>
          ))}
        </RailList>
      )}
    </RailPanel>
  );
}
