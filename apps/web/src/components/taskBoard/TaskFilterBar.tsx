import type { TaskBoardTaskPriority, TaskBoardTaskStatus } from "@t3tools/contracts";
import {
  ArrowUpDownIcon,
  FlagIcon,
  GroupIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { memo, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import {
  Menu,
  MenuCheckboxItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "~/components/ui/menu";
import { Toggle } from "~/components/ui/toggle";

import { priorityLabel, statusLabel, type TaskSort } from "./taskBoard.logic";
import { activeFilterCount, type TaskListGroupBy, type TasksPrefs } from "./tasksPage.logic";

const STATUS_CHIPS: ReadonlyArray<TaskBoardTaskStatus> = [
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
];
const PRIORITIES: ReadonlyArray<TaskBoardTaskPriority> = ["critical", "high", "medium", "low"];
const SORT_LABELS: Record<TaskSort, string> = {
  priority: "Priority",
  updated: "Recently updated",
  due: "Due date",
  title: "Title",
};
const GROUP_LABELS: Record<TaskListGroupBy, string> = {
  project: "Project",
  status: "Status",
  none: "None",
};

function toggled<T>(list: ReadonlyArray<T> | null, value: T, on: boolean): T[] | null {
  const next = on ? [...(list ?? []), value] : (list ?? []).filter((item) => item !== value);
  return next.length > 0 ? next : null;
}

/** The search box, status chips and filter menus above the Board and List views. */
export const TaskFilterBar = memo(function TaskFilterBar(props: {
  readonly prefs: TasksPrefs;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onPrefsChange: (patch: Partial<TasksPrefs>) => void;
  /** Group-by only applies to the List view. */
  readonly showGroupBy: boolean;
  /** The Board always shows its Done column, so it has no closed-work toggle. */
  readonly showClosedToggle: boolean;
  /** The narrow-window project picker, shown in front of the search box. */
  readonly leading?: ReactNode;
}) {
  const { prefs, query, onPrefsChange } = props;
  const activeCount = activeFilterCount(prefs, query);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {props.leading}
        <InputGroup className="min-w-40 max-w-80 flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden className="size-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            size="sm"
            aria-label="Search tasks"
            placeholder="Search tasks"
            value={query}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </InputGroup>
        <Toggle
          variant="outline"
          size="compact"
          pressed={prefs.mine}
          onPressedChange={(mine) => onPrefsChange({ mine })}
        >
          <UserIcon />
          Mine
        </Toggle>
        <Toggle
          variant="outline"
          size="compact"
          pressed={prefs.sharedOnly}
          onPressedChange={(sharedOnly) => onPrefsChange({ sharedOnly })}
        >
          <UsersIcon />
          Shared
        </Toggle>
        {props.showClosedToggle ? (
          <Toggle
            variant="outline"
            size="compact"
            pressed={prefs.includeClosed}
            onPressedChange={(includeClosed) => onPrefsChange({ includeClosed })}
          >
            Show closed
          </Toggle>
        ) : null}
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="compact" />}>
            <FlagIcon />
            {prefs.priorities ? `Priority (${prefs.priorities.length})` : "Priority"}
          </MenuTrigger>
          <MenuPopup align="start">
            {PRIORITIES.map((priority) => (
              <MenuCheckboxItem
                key={priority}
                checked={prefs.priorities?.includes(priority) ?? false}
                onCheckedChange={(on) =>
                  onPrefsChange({ priorities: toggled(prefs.priorities, priority, on) })
                }
              >
                {priorityLabel(priority)}
              </MenuCheckboxItem>
            ))}
          </MenuPopup>
        </Menu>
        <Menu>
          <MenuTrigger render={<Button variant="outline" size="compact" />}>
            <ArrowUpDownIcon />
            {SORT_LABELS[prefs.sort]}
          </MenuTrigger>
          <MenuPopup align="start">
            <MenuRadioGroup
              value={prefs.sort}
              onValueChange={(value) => {
                if (value in SORT_LABELS) onPrefsChange({ sort: value as TaskSort });
              }}
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <MenuRadioItem key={value} value={value}>
                  {label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuPopup>
        </Menu>
        {props.showGroupBy ? (
          <Menu>
            <MenuTrigger render={<Button variant="outline" size="compact" />}>
              <GroupIcon />
              {`Group: ${GROUP_LABELS[prefs.groupBy]}`}
            </MenuTrigger>
            <MenuPopup align="start">
              <MenuRadioGroup
                value={prefs.groupBy}
                onValueChange={(value) => {
                  if (value in GROUP_LABELS) onPrefsChange({ groupBy: value as TaskListGroupBy });
                }}
              >
                {Object.entries(GROUP_LABELS).map(([value, label]) => (
                  <MenuRadioItem key={value} value={value}>
                    {label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_CHIPS.map((status) => (
          <Toggle
            key={status}
            variant="outline"
            size="compact"
            pressed={prefs.statuses?.includes(status) ?? false}
            onPressedChange={(on) =>
              onPrefsChange({ statuses: toggled(prefs.statuses, status, on) })
            }
          >
            {statusLabel(status)}
          </Toggle>
        ))}
        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="compact"
            onClick={() => {
              props.onQueryChange("");
              onPrefsChange({ statuses: null, priorities: null, mine: false, sharedOnly: false });
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
});
