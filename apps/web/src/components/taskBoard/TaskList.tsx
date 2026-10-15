import {
  BotIcon,
  CheckIcon,
  CircleIcon,
  ChevronDownIcon,
  EllipsisIcon,
  ListIcon,
} from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { cn } from "~/lib/utils";
import { ChecklistBar, DueChip, PriorityBadge, SharedBadge, StatusBadge } from "./TaskBadges";
import { ClaimedBy, LaneChip, ProjectChip, useLatest } from "./TaskRowParts";
import {
  isOpen,
  relativeTime,
  statusLabel,
  type TaskSectionGroup,
  type TaskView,
} from "./taskBoard.logic";
import type { TaskActions, TaskContext } from "./taskBoard.types";
import {
  buildListGroups,
  isGroupExpanded,
  nextTaskId,
  projectNameFor,
  projectNameIndex,
  sameMember,
  statusDotClass,
  visibleTaskIds,
  type ListGroup,
  type ListNavigationKey,
} from "./taskRows";

type RowAction = "send" | "claim" | "release" | "complete" | "reopen";

type RowProps = {
  readonly task: TaskView;
  readonly selected: boolean;
  readonly tabbable: boolean;
  readonly busy: boolean;
  readonly now: number;
  readonly projectName: string | null;
  readonly showStatusBadge: boolean;
  readonly canSend: boolean;
  readonly mine: boolean;
  readonly onSelect: (task: TaskView) => void;
  readonly onAction: (task: TaskView, action: RowAction) => void;
};

const TaskRow = memo(function TaskRow({
  task,
  selected,
  tabbable,
  busy,
  now,
  projectName,
  showStatusBadge,
  canSend,
  mine,
  onSelect,
  onAction,
}: RowProps) {
  const open = isOpen(task);
  const done = task.status === "done";
  return (
    <li
      aria-busy={busy}
      className={cn(
        "@container group/row flex items-center gap-1 border-b pr-2 pl-3 hover:bg-accent/40",
        selected && "bg-accent/70 hover:bg-accent/70",
        busy && "opacity-60",
      )}
    >
      <Button
        variant="ghost-muted"
        size="icon-sm"
        disabled={busy}
        aria-label={`${done ? "Reopen" : "Complete"} ${task.title}`}
        onClick={() => onAction(task, done ? "reopen" : "complete")}
      >
        {done ? <CheckIcon /> : <CircleIcon />}
      </Button>
      <button
        aria-current={selected ? "true" : undefined}
        className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1.5 text-left outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        data-row-id={task.id}
        onClick={() => onSelect(task)}
        tabIndex={tabbable ? 0 : -1}
        type="button"
      >
        <span
          aria-label={statusLabel(task.status)}
          className={cn("size-2 shrink-0 rounded-full", statusDotClass(task.status))}
          role="img"
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 @min-[36rem]:flex">
          {showStatusBadge ? <StatusBadge status={task.status} /> : null}
          <LaneChip labels={task.labels} />
          <ProjectChip name={projectName} />
          <PriorityBadge priority={task.priority} />
          {done ? null : <DueChip due={task.due} now={now} />}
          <SharedBadge task={task} />
        </span>
        <span className="hidden shrink-0 items-center @min-[52rem]:flex">
          <ChecklistBar checklist={task.checklist} />
        </span>
        <span className="hidden w-32 shrink-0 @min-[52rem]:flex">
          <ClaimedBy agent={task.claimedAgent} name={task.claimedBy} />
        </span>
        <span className="hidden w-16 shrink-0 text-right text-muted-foreground text-xs tabular-nums @min-[36rem]:block">
          {relativeTime(task.updatedAt, now)}
        </span>
      </button>
      <div className="shrink-0 opacity-0 focus-within:opacity-100 group-hover/row:opacity-100 has-[[data-popup-open]]:opacity-100 pointer-coarse:opacity-100">
        <Menu>
          <MenuTrigger
            render={
              <Button
                aria-label={`Actions for ${task.title}`}
                disabled={busy}
                size="icon-xs"
                variant="ghost-muted"
              />
            }
          >
            <EllipsisIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            {canSend ? (
              <MenuItem onClick={() => onAction(task, "send")}>
                <BotIcon />
                Send to AI
              </MenuItem>
            ) : null}
            {open && !task.claimedBy ? (
              <MenuItem onClick={() => onAction(task, "claim")}>Take</MenuItem>
            ) : null}
            {open && mine ? (
              <MenuItem onClick={() => onAction(task, "release")}>Give back</MenuItem>
            ) : null}
            <MenuSeparator />
            {done ? (
              <MenuItem onClick={() => onAction(task, "reopen")}>Reopen</MenuItem>
            ) : (
              <MenuItem onClick={() => onAction(task, "complete")}>Mark complete</MenuItem>
            )}
          </MenuPopup>
        </Menu>
      </div>
    </li>
  );
});

const NAV_KEYS: ReadonlySet<string> = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

function GroupHeader({
  group,
  expanded,
  onToggle,
}: {
  readonly group: ListGroup;
  readonly expanded: boolean;
  readonly onToggle: (key: string) => void;
}) {
  return (
    <button
      aria-expanded={expanded}
      className="sticky top-0 z-10 flex h-8 w-full cursor-pointer items-center gap-2 border-b bg-background px-3 text-left font-medium text-muted-foreground text-xs outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={() => onToggle(group.key)}
      type="button"
    >
      <ChevronDownIcon aria-hidden className={cn("size-3.5 shrink-0", !expanded && "-rotate-90")} />
      <span className="truncate text-foreground">{group.label}</span>
      <Badge size="sm" variant="secondary">
        {group.count}
      </Badge>
      {group.openCount !== null && group.openCount !== group.count ? (
        <span className="font-normal tabular-nums">{group.openCount} open</span>
      ) : null}
    </button>
  );
}

export function TaskListView(props: {
  tasks: ReadonlyArray<TaskView>;
  sections: ReadonlyArray<TaskSectionGroup>;
  groupBy: "project" | "status" | "none";
  context: TaskContext;
  actions: TaskActions;
  selectedId: string | null;
  onSelect: (task: TaskView) => void;
}) {
  const { tasks, sections, groupBy, context, actions, selectedId } = props;
  const actionsRef = useLatest(actions);
  const onSelectRef = useLatest(props.onSelect);
  const listRef = useRef<HTMLDivElement>(null);
  const [overrides, setOverrides] = useState<Readonly<Record<string, boolean>>>({});

  const groups = useMemo(
    () => buildListGroups({ tasks, sections, groupBy }),
    [tasks, sections, groupBy],
  );
  const projectNames = useMemo(() => projectNameIndex(context.projects), [context.projects]);
  // Inside a single project the chip on every row only repeats the page title.
  const singleProject = useMemo(
    () => new Set(tasks.map((task) => task.section)).size <= 1,
    [tasks],
  );
  const visibleIds = useMemo(() => visibleTaskIds(groups, overrides), [groups, overrides]);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const tabbableId =
    selectedId !== null && visibleIds.includes(selectedId) ? selectedId : (visibleIds[0] ?? null);

  const select = useCallback((task: TaskView) => onSelectRef.current(task), [onSelectRef]);
  const toggle = useCallback(
    (key: string) => {
      const group = groups.find((candidate) => candidate.key === key);
      if (!group) return;
      setOverrides((current) => ({ ...current, [key]: !isGroupExpanded(group, current) }));
    },
    [groups],
  );
  const runAction = useCallback(
    (task: TaskView, action: RowAction) => {
      const current = actionsRef.current;
      switch (action) {
        case "send":
          return current.sendToAgent(task);
        case "claim":
          return current.claim(task);
        case "release":
          return current.release(task);
        case "complete":
          return current.setStatus(task, "done");
        case "reopen":
          return current.setStatus(task, "todo");
      }
    },
    [actionsRef],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!NAV_KEYS.has(event.key) || !(event.target instanceof HTMLElement)) return;
    const currentId = event.target.closest("[data-row-id]")?.getAttribute("data-row-id");
    // Only rows take part; group headers and menus keep their own key handling.
    if (currentId === undefined || currentId === null) return;
    event.preventDefault();
    const nextId = nextTaskId(visibleIds, currentId, event.key as ListNavigationKey);
    const next = nextId === null ? undefined : tasksById.get(nextId);
    if (!next || nextId === currentId) return;
    select(next);
    listRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(nextId!)}"]`)?.focus();
  };

  if (groups.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListIcon />
          </EmptyMedia>
          <EmptyTitle>No tasks to show</EmptyTitle>
          <EmptyDescription>
            Add a task above, choose another view, or clear your filters.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto" onKeyDown={onKeyDown} ref={listRef}>
      {groups.map((group) => {
        const expanded = isGroupExpanded(group, overrides);
        return (
          <section key={group.key}>
            {group.label !== null ? (
              <GroupHeader expanded={expanded} group={group} onToggle={toggle} />
            ) : null}
            {expanded ? (
              <ul>
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    busy={actions.isBusy(task.id)}
                    canSend={actions.canSendToAgent(task)}
                    mine={sameMember(task.claimedBy, context.member)}
                    now={context.now}
                    onAction={runAction}
                    onSelect={select}
                    projectName={
                      groupBy === "project" || singleProject
                        ? null
                        : projectNameFor(task, projectNames)
                    }
                    selected={selectedId === task.id}
                    showStatusBadge={groupBy !== "status"}
                    tabbable={tabbableId === task.id}
                    task={task}
                  />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
