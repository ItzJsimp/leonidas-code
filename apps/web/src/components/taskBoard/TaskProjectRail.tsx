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

import type { RailEntry } from "./tasksPage.logic";

const ALL = "__all__";

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
      <span className="min-w-0 flex-1 truncate text-left">{props.label}</span>
      {props.shareable ? (
        <Tooltip>
          <TooltipTrigger render={<span className="shrink-0 text-muted-foreground" />}>
            <UsersIcon aria-hidden className="size-3" />
            <span className="sr-only">Can be shared with collaborators</span>
          </TooltipTrigger>
          <TooltipPopup>Can be shared with collaborators</TooltipPopup>
        </Tooltip>
      ) : null}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{props.count}</span>
    </Button>
  );
}

/** Lists the projects that have tasks. Selecting one narrows every view to it. */
export const TaskProjectRail = memo(function TaskProjectRail(props: {
  readonly entries: ReadonlyArray<RailEntry>;
  readonly allOpen: number;
  readonly selectedSlug: string | null;
  readonly onSelect: (slug: string | null) => void;
}) {
  const { onSelect } = props;
  return (
    <nav aria-label="Projects" className="flex flex-col gap-0.5">
      <RailRow
        label="All tasks"
        count={props.allOpen}
        selected={props.selectedSlug === null}
        onSelect={() => onSelect(null)}
      />
      {props.entries.map((entry) => (
        <RailRow
          key={entry.slug}
          label={entry.name}
          count={entry.open}
          selected={props.selectedSlug === entry.slug}
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
}) {
  const { onSelect } = props;
  const items = useMemo(
    () => ({
      [ALL]: "All tasks",
      ...Object.fromEntries(props.entries.map((entry) => [entry.slug, entry.name])),
    }),
    [props.entries],
  );
  return (
    <Select
      value={props.selectedSlug ?? ALL}
      items={items}
      onValueChange={(value) => {
        if (typeof value === "string") onSelect(value === ALL ? null : value);
      }}
    >
      <SelectTrigger size="sm" aria-label="Project" className="min-w-0">
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
