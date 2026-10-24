import type { AiosDirectionGoal, TaskBoardHome } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CompassIcon,
  FileTextIcon,
  FlagIcon,
  FolderSearchIcon,
  SparklesIcon,
} from "lucide-react";
import { type ComponentType, type ReactNode, type SVGProps, useMemo } from "react";

import { AiosFileView } from "~/components/aiosFile/AiosFileView";
import { useOpenAiosFile } from "~/components/aiosFile/useOpenAiosFile";
import { CalendarAgenda } from "~/components/calendar/CalendarAgenda";
import { Ring } from "~/components/commandCenter/charts";
import {
  HomeWidget,
  WidgetEmpty,
  WidgetError,
  WidgetSkeleton,
} from "~/components/commandCenter/HomeWidget";
import { useGoals, useNowMs, useTaskCards } from "~/components/commandCenter/useHomeReads";
import { DueChip, PriorityBadge } from "~/components/taskBoard/TaskBadges";
import { usePlacePrompt } from "~/components/taskBoard/DirectionSection";
import { FIRST_PLAN_PROMPT } from "~/components/taskBoard/direction.logic";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

import { RailWindow, WindowEmpty, WindowError, type WindowTab } from "../../twoState/RailWindow";
import { Tip } from "../../twoState/Tip";
import { PriorityChecklist } from "./PriorityChecklist";
import {
  briefFileFor,
  dueRows,
  localDay,
  planTodayPrompt,
  prioritySummary,
  shortDay,
  taskCardPath,
} from "./today.logic";
import { usePriorities } from "./usePriorities";

const TABS: readonly WindowTab[] = [
  { id: "overview", label: "Overview" },
  { id: "schedule", label: "Schedule" },
  { id: "briefing", label: "Briefing" },
];

const LINK =
  "inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";

/** A dashed box for a first step: what goes here, and one button that starts it. */
function FirstStep({
  icon: Icon,
  title,
  line,
  action,
  notice,
}: {
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly title: string;
  readonly line: ReactNode;
  readonly action?: ReactNode;
  readonly notice?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 justify-items-start gap-1.5 text-sm">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{line}</p>
        {action}
        {notice ? (
          <p role="status" className="text-xs text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** A small number with its label, the way the Command Center states a count. */
function Stat({
  label,
  value,
  unit,
  tip,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly unit?: string;
  readonly tip: string;
}) {
  return (
    <Tip text={tip}>
      <div
        tabIndex={0}
        className="min-w-0 rounded-xl border border-border bg-card px-4 py-3 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-2xl leading-none font-semibold tabular-nums">
            {value}
          </span>
          {unit ? <span className="truncate text-sm text-muted-foreground">{unit}</span> : null}
        </p>
      </div>
    </Tip>
  );
}

function PrioritiesCard({ today }: { readonly today: string }) {
  const { brief, priorities, toggle } = usePriorities();
  const { open } = useOpenAiosFile();
  const cards = useTaskCards().data?.tasks;
  const { place, notice } = usePlacePrompt();
  const summary = prioritySummary(priorities);
  const cardPath = useMemo(() => {
    const byId = new Map((cards ?? []).map((task) => [task.id, taskCardPath(task)]));
    return (taskId: string) => byId.get(taskId) ?? null;
  }, [cards]);
  const plan = (
    <Button size="xs" variant="outline" onClick={() => void place(planTodayPrompt(today))}>
      <SparklesIcon aria-hidden />
      Plan today with Leonidas
    </Button>
  );
  const stale = brief !== null && brief.date !== today;
  return (
    <HomeWidget
      title="Today's priorities"
      count={summary.total > 0 ? summary.label : undefined}
      aside={
        brief ? (
          <Button size="xs" variant="ghost-muted" onClick={() => void open(brief.file)}>
            <FileTextIcon aria-hidden />
            {stale ? `Brief of ${shortDay(brief.date)}` : "Open brief"}
          </Button>
        ) : undefined
      }
    >
      {summary.total === 0 ? (
        <FirstStep
          icon={CalendarCheckIcon}
          title={brief ? "Your brief has no priorities yet" : "Write today's priorities"}
          line={
            <>
              Leonidas reads them from a checklist in{" "}
              <span className="font-mono text-xs">{briefFileFor(today)}</span>. Plan the day in a
              chat and they show here as tick boxes.
            </>
          }
          action={plan}
          notice={notice}
        />
      ) : (
        <div className="grid gap-3">
          {stale ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1">
                These are from {shortDay(brief.date)}. Today has no brief yet.
              </span>
              {plan}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Ring
              percent={Math.round(summary.fraction * 100)}
              label={`${summary.done} of ${summary.total} priorities done`}
            >
              {`${summary.done}/${summary.total}`}
            </Ring>
            <p className="text-sm text-muted-foreground">
              Tick a box when it is done. The change saves to your brief.
            </p>
          </div>
          <PriorityChecklist
            priorities={priorities}
            onToggle={(priority) => void toggle(priority)}
            cardPath={cardPath}
            onOpenFile={(path) => void open(path)}
          />
          {notice ? (
            <p role="status" className="text-xs text-muted-foreground">
              {notice}
            </p>
          ) : null}
        </div>
      )}
    </HomeWidget>
  );
}

function DueCard({ today }: { readonly today: string }) {
  const cards = useTaskCards();
  const now = useNowMs();
  const { open } = useOpenAiosFile();
  const rows = useMemo(
    () => (cards.data ? dueRows(cards.data.tasks, today) : null),
    [cards.data, today],
  );
  const overdue = rows?.filter((row) => row.overdue).length ?? 0;
  return (
    <HomeWidget
      title="Due today"
      count={
        rows && rows.length > 0 ? (overdue > 0 ? `${overdue} overdue` : rows.length) : undefined
      }
      aside={
        <Link to="/tasks" className={LINK}>
          All tasks
          <ArrowRightIcon aria-hidden className="size-3.5" />
        </Link>
      }
    >
      {rows === null ? (
        cards.error !== null ? (
          <WidgetError message="Your task cards could not be read." onRetry={cards.refresh} />
        ) : (
          <WidgetSkeleton rows={3} />
        )
      ) : rows.length === 0 ? (
        <WidgetEmpty>
          Nothing is due today or late. Give a task card a due date and it shows here on that day.
        </WidgetEmpty>
      ) : (
        <ul className="-my-1 divide-y divide-border/60">
          {rows.slice(0, 8).map((row) => (
            <li key={row.id} className="py-1">
              <Tip text={row.path ? `Open ${row.path}` : "This card is not in your AIOS folder."}>
                <button
                  type="button"
                  disabled={row.path === null}
                  onClick={() => row.path && void open(row.path)}
                  className="flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
                  <PriorityBadge priority={row.priority} />
                  <DueChip due={row.due} now={now} />
                </button>
              </Tip>
            </li>
          ))}
          {rows.length > 8 ? (
            <li className="pt-2 text-xs text-muted-foreground">
              {rows.length - 8} more on the Tasks page.
            </li>
          ) : null}
        </ul>
      )}
    </HomeWidget>
  );
}

function NextMoveCard({ home }: { readonly home: TaskBoardHome }) {
  const cards = useTaskCards().data?.tasks;
  const { open } = useOpenAiosFile();
  const task = home.move.taskId ? cards?.find((card) => card.id === home.move.taskId) : undefined;
  const path = task ? taskCardPath(task) : null;
  return (
    <HomeWidget title="Next move">
      <div className="flex items-start gap-3">
        <CompassIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="grid min-w-0 justify-items-start gap-1">
          <p className="text-sm font-semibold wrap-anywhere">{home.move.title}</p>
          <p className="text-sm text-muted-foreground">{home.move.reason}</p>
          {path ? (
            <Button size="xs" variant="outline" onClick={() => void open(path)}>
              <FileTextIcon aria-hidden />
              Open the card
            </Button>
          ) : home.move.kind !== "rest" ? (
            <Link to="/tasks" className={LINK}>
              Open Tasks
              <ArrowRightIcon aria-hidden className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </HomeWidget>
  );
}

function GoalRow({
  goal,
  onOpen,
}: {
  readonly goal: AiosDirectionGoal;
  readonly onOpen: () => void;
}) {
  return (
    <li className="py-1">
      <Tip text={`${goal.goal}. Opens ideal-state/goals.md.`}>
        <button
          type="button"
          onClick={onOpen}
          className="grid w-full min-w-0 grid-cols-[1fr_auto] items-baseline gap-x-2 rounded-md px-1 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="truncate text-sm">{goal.goal}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{goal.targetDate}</span>
          {goal.status ? (
            <span className="col-span-2 truncate text-xs text-muted-foreground">{goal.status}</span>
          ) : null}
        </button>
      </Tip>
    </li>
  );
}

function GoalsCard() {
  const goals = useGoals();
  const { open } = useOpenAiosFile();
  const { place, notice } = usePlacePrompt();
  const list = goals.data?.goals ?? null;
  return (
    <HomeWidget title="Goals" count={list && list.length > 0 ? list.length : undefined}>
      {list === null ? (
        goals.error !== null ? (
          <WidgetError message="Your goals could not be read." onRetry={goals.refresh} />
        ) : (
          <WidgetSkeleton rows={2} />
        )
      ) : list.length === 0 ? (
        <FirstStep
          icon={FlagIcon}
          title="No goals yet"
          line="Goals keep each day pointed somewhere. Set them in a 10-minute chat."
          action={
            <Button size="xs" variant="outline" onClick={() => void place(FIRST_PLAN_PROMPT)}>
              <SparklesIcon aria-hidden />
              Set your direction
            </Button>
          }
          notice={notice}
        />
      ) : (
        <ul className="-my-1 divide-y divide-border/60">
          {list.slice(0, 5).map((goal) => (
            <GoalRow key={goal.id} goal={goal} onOpen={() => void open("ideal-state/goals.md")} />
          ))}
        </ul>
      )}
    </HomeWidget>
  );
}

function BriefingCard({ home }: { readonly home: TaskBoardHome }) {
  const brief = home.brief;
  if (brief === null) return null;
  return (
    <HomeWidget title="Briefing" count={shortDay(brief.date)}>
      <div className="max-h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,black_75%,transparent)]">
        <AiosFileView path={brief.file} />
      </div>
    </HomeWidget>
  );
}

function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading today" className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16" shape="card" />
        ))}
      </div>
      <Skeleton className="h-48" shape="card" />
    </div>
  );
}

function Overview() {
  const { home } = usePriorities();
  const now = useNowMs();
  const today = localDay(now);
  const cards = useTaskCards().data;
  const due = useMemo(() => (cards ? dueRows(cards.tasks, today).length : null), [cards, today]);
  const data = home.data;
  if (data === null && home.error !== null) {
    return (
      <WindowError
        message="Today did not load. Check that Leonidas is running, then try again."
        onRetry={home.refresh}
      />
    );
  }
  if (data === null) return <OverviewSkeleton />;
  if (data.root === null) {
    return (
      <WindowEmpty
        icon={FolderSearchIcon}
        title="No AIOS folder connected yet"
        line="Your AIOS is the folder with your notes and tasks. Connect it and your priorities, tasks and goals show here."
        action={{ label: "Connect your AIOS folder", to: "/tasks" }}
      />
    );
  }
  const summary = prioritySummary(data.brief?.priorities);
  const dateLine = new Date(now).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{dateLine}</p>
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Stat
          label="Priorities done"
          value={summary.total > 0 ? summary.done : "None"}
          {...(summary.total > 0 ? { unit: `of ${summary.total}` } : {})}
          tip="Priorities ticked in today's brief, out of all of them."
        />
        <Stat
          label="Due today"
          value={due ?? <Skeleton className="inline-block h-6 w-6 align-middle" />}
          unit={due === 1 ? "task" : "tasks"}
          tip="Open task cards due today or late."
        />
        <Stat
          label="In progress"
          value={data.counts.inProgress}
          unit={data.counts.inProgress === 1 ? "task" : "tasks"}
          tip="Task cards marked In progress."
        />
        <Stat
          label="Waiting for review"
          value={data.counts.review}
          unit={data.counts.review === 1 ? "task" : "tasks"}
          tip="Finished work that waits for your sign-off."
        />
      </div>
      <div className="grid items-start gap-4 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 gap-4">
          <PrioritiesCard today={today} />
          <DueCard today={today} />
        </div>
        <div className="grid min-w-0 gap-4">
          <HomeWidget title="Schedule">
            <CalendarAgenda variant="today" />
          </HomeWidget>
          <NextMoveCard home={data} />
          <GoalsCard />
          <BriefingCard home={data} />
        </div>
      </div>
    </div>
  );
}

function Briefing() {
  const { home } = usePriorities();
  const today = localDay(useNowMs());
  const { place, notice } = usePlacePrompt();
  const brief = home.data?.brief ?? null;
  if (home.data === null && home.error !== null) {
    return <WindowError message="The briefing did not load." onRetry={home.refresh} />;
  }
  if (home.data === null) return <OverviewSkeleton />;
  if (brief === null) {
    return (
      <FirstStep
        icon={FileTextIcon}
        title="No briefing yet"
        line={
          <>
            A briefing is a short note for the day, saved as{" "}
            <span className="font-mono text-xs">{briefFileFor(today)}</span>. Plan today in a chat
            and Leonidas writes it.
          </>
        }
        action={
          <Button size="xs" variant="outline" onClick={() => void place(planTodayPrompt(today))}>
            <SparklesIcon aria-hidden />
            Plan today with Leonidas
          </Button>
        }
        notice={notice}
      />
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-2">
      {brief.date !== today ? (
        <p className="text-xs text-muted-foreground">
          This is your newest brief, from {shortDay(brief.date)}.
        </p>
      ) : null}
      <AiosFileView path={brief.file} />
    </div>
  );
}

/** The Today window: the day at a glance, the full schedule, and the briefing to read. */
export function TodayWindow() {
  return (
    <RailWindow title="Today" tabs={TABS}>
      {(tab) => (
        <div className="@container">
          {tab === "schedule" ? (
            <CalendarAgenda variant="today" />
          ) : tab === "briefing" ? (
            <Briefing />
          ) : (
            <Overview />
          )}
        </div>
      )}
    </RailWindow>
  );
}
