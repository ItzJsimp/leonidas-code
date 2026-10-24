import { LayersIcon, UsersIcon } from "lucide-react";
import { memo, useMemo } from "react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { RailEntry, TaskFocus } from "./tasksPage.logic";

const ALL = "__all__";
const FOCUS_LABELS = { inbox: "Inbox", today: "Today", upcoming: "Upcoming" } as const;
const DAILY_FOCUSES = ["inbox", "today", "upcoming"] as const;

function RailRow(props: {
  readonly label: string;
  readonly count: number;
  readonly selected: boolean;
  readonly shareable?: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <Button
      variant={props.selected ? "secondary" : "ghost"}
      size="sm"
      className="w-full justify-start"
      aria-current={props.selected ? "true" : undefined}
      onClick={props.onSelect}
    >
      <Tooltip>
        <TooltipTrigger render={<span className="min-w-0 flex-1 truncate text-left" />}>
          {props.label}
        </TooltipTrigger>
        <TooltipPopup side="right">{props.label}</TooltipPopup>
      </Tooltip>
      {props.shareable ? (
        <Tooltip>
          <TooltipTrigger render={<span className="shrink-0 text-muted-foreground" />}>
            <UsersIcon aria-hidden className="size-3" />
            <span className="sr-only">Can be shared with collaborators</span>
          </TooltipTrigger>
          <TooltipPopup>Can be shared with collaborators</TooltipPopup>
        </Tooltip>
      ) : null}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {props.count.toLocaleString("en-US")}
      </span>
    </Button>
  );
}

/** Lists the projects that have tasks. Selecting one narrows every view to it. */
export const TaskProjectRail = memo(function TaskProjectRail(props: {
  readonly entries: ReadonlyArray<RailEntry>;
  readonly allOpen: number;
  readonly selectedSlug: string | null;
  readonly onSelect: (slug: string | null) => void;
  readonly focus: TaskFocus;
  readonly counts: Record<(typeof DAILY_FOCUSES)[number], number>;
  readonly onFocus: (focus: TaskFocus) => void;
}) {
  const { onSelect } = props;
  return (
    <nav aria-label="Projects" className="flex flex-col gap-0.5">
      {DAILY_FOCUSES.map((focus) => (
        <RailRow
          key={focus}
          label={FOCUS_LABELS[focus]}
          count={props.counts[focus]}
          selected={props.focus === focus}
          onSelect={() => props.onFocus(focus)}
        />
      ))}
      <RailRow
        label="All tasks"
        count={props.allOpen}
        selected={props.focus === "all" && props.selectedSlug === null}
        onSelect={() => onSelect(null)}
      />
      <h2 className="px-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">Projects</h2>
      {props.entries.map((entry) => (
        <RailRow
          key={entry.slug}
          label={entry.name}
          count={entry.open}
          selected={props.focus === "all" && props.selectedSlug === entry.slug}
          shareable={entry.repository !== null && entry.projectId !== null}
          onSelect={() => onSelect(entry.slug)}
        />
      ))}
    </nav>
  );
});

/** The rail's stand-in on narrow windows, where there is no room for a column. */
export const TaskProjectSelect = memo(function TaskProjectSelect(props: {
  readonly entries: ReadonlyArray<RailEntry>;
  readonly selectedSlug: string | null;
  readonly onSelect: (slug: string | null) => void;
  readonly focus: TaskFocus;
  readonly onFocus: (focus: TaskFocus) => void;
}) {
  const { onSelect } = props;
  const items = useMemo(
    () => ({
      [ALL]: "All tasks",
      ...Object.fromEntries(DAILY_FOCUSES.map((focus) => [`__${focus}__`, FOCUS_LABELS[focus]])),
      ...Object.fromEntries(props.entries.map((entry) => [entry.slug, entry.name])),
    }),
    [props.entries],
  );
  return (
    <Select
      value={props.focus === "all" ? (props.selectedSlug ?? ALL) : `__${props.focus}__`}
      items={items}
      onValueChange={(value) => {
        const focus = DAILY_FOCUSES.find((item) => value === `__${item}__`);
        if (focus) props.onFocus(focus);
        else if (typeof value === "string") onSelect(value === ALL ? null : value);
      }}
    >
      <SelectTrigger size="sm" aria-label="Task view or project" className="min-w-0">
        <LayersIcon aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {Object.entries(items).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
});
