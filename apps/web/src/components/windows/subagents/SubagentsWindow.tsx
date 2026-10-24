import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { SubagentRun } from "@t3tools/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { BotIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { toastManager } from "~/components/ui/toast";
import { observeResize } from "~/lib/observeResize";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { threadEnvironment } from "~/state/threads";

import { RailWindow, WindowError } from "../../twoState/RailWindow";
import { Tip } from "../../twoState/Tip";
import { SubagentDetail } from "./SubagentDetail";
import { RunRow } from "./SubagentRows";
import {
  EMPTY_HISTORY,
  EMPTY_RUNNING,
  isLive,
  matchRuns,
  STATUS_FILTERS,
  subagentsTab,
  subagentsTabs,
} from "./subagents.logic";
import { useHistoryRuns, useRunningRuns, type HistoryFilters } from "./useSubagentRuns";

/** Below this pane width the list and the details take turns. */
const NARROW_PANE = 720;
const ALL_CHATS = "all";

/** A clock that ticks each second while a run is live and the page is visible. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function EmptyBlock({
  title,
  line,
  action,
}: {
  readonly title: string;
  readonly line: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <BotIcon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{line}</p>
      {action ? (
        <Button size="sm" variant="outline" onClick={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The Subagents window: the helpers that chats start. Running shows live ones with Open and
 * Stop. History shows every run that ended, with its task, its answer and its timing.
 */
export function SubagentsWindow() {
  const search = useSearch({ strict: false }) as { readonly tab?: unknown };
  const tab = subagentsTab(typeof search.tab === "string" ? search.tab : undefined);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<HistoryFilters["status"]>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);

  const running = useRunningRuns();
  const filters = useMemo<HistoryFilters>(
    () => ({ status, parentThreadId: parentId, query }),
    [status, parentId, query],
  );
  const history = useHistoryRuns(tab === "history", filters, running.signature);
  const stop = useOrchestrationCommand(threadEnvironment.interruptTurn, { reportFailure: false });

  useEffect(() => {
    if (!frame) return;
    return observeResize(frame, (entries) => {
      const width = entries.at(-1)?.contentRect.width;
      if (width !== undefined) setNarrow(width < NARROW_PANE);
    });
  }, [frame]);

  const liveRuns = useMemo(() => matchRuns(running.runs ?? [], query), [running.runs, query]);
  const shown: ReadonlyArray<SubagentRun> | null =
    tab === "running" ? (running.runs === null ? null : liveRuns) : history.runs;
  const now = useNow(tab === "running" ? liveRuns.length > 0 : (shown ?? []).some(isLive));
  const selected = shown?.find((run) => run.id === selectedId);
  const showDetail = selected !== undefined && (!narrow || detailOpen);
  const showList = !narrow || !showDetail;
  const filtering = query.trim() !== "" || status !== null || parentId !== null;
  const loadError = tab === "running" ? running.error : history.error;
  const environmentId = running.environmentId;

  const openThread = (threadId: string) => {
    if (!environmentId) return;
    void navigate({
      to: "/$environmentId/$threadId",
      params: { environmentId, threadId: threadId as SubagentRun["parent"]["id"] },
    });
  };
  const openRun = (run: SubagentRun) => openThread(run.childThreadId ?? run.parent.id);

  const stopRun = async (run: SubagentRun) => {
    if (!environmentId || !run.childThreadId) return;
    setStoppingId(run.id);
    const result = await stop({ environmentId, input: { threadId: run.childThreadId } });
    setStoppingId(null);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not stop the subagent",
        description: error instanceof Error ? error.message : "Try again.",
      });
      return;
    }
    void running.reload();
  };

  const switchTab = (id: "running" | "history") =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        tab: id === "running" ? undefined : id,
      })) as never,
      replace: true,
    });
  const clearFilters = () => {
    setQuery("");
    setStatus(null);
    setParentId(null);
  };
  const select = (run: SubagentRun) => {
    setSelectedId(run.id);
    setDetailOpen(true);
  };

  const actions = (
    <>
      <div className="w-48 max-[727px]:w-full sm:w-56">
        <Input
          type="search"
          size="compact"
          aria-label="Search subagents"
          placeholder="Search tasks and chats"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <Tip text="Ask for the latest runs">
        <Button
          size="xs"
          variant="ghost-muted"
          onClick={() => {
            void running.reload();
            history.reload();
          }}
        >
          <RefreshCwIcon aria-hidden />
          Refresh
        </Button>
      </Tip>
    </>
  );

  return (
    <RailWindow title="Subagents" tabs={subagentsTabs(running.runningCount)} actions={actions}>
      {tab === "history" ? (
        <div role="group" aria-label="Filter the history" className="mb-3 flex flex-wrap gap-2">
          <div className="w-44">
            <Select
              value={status ?? "all"}
              onValueChange={(value) =>
                setStatus(value === "all" ? null : (value as HistoryFilters["status"]))
              }
            >
              <SelectTrigger size="sm" aria-label="Filter by result">
                <SelectValue>
                  {STATUS_FILTERS.find((item) => item.id === (status ?? "all"))?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                {STATUS_FILTERS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          <div className="w-56 max-w-full">
            <Select
              value={parentId ?? ALL_CHATS}
              onValueChange={(value) => setParentId(value === ALL_CHATS ? null : value)}
            >
              <SelectTrigger size="sm" aria-label="Filter by parent chat">
                <SelectValue>
                  {parentId === null
                    ? "All chats"
                    : (history.parents.find((parent) => parent.id === parentId)?.title ??
                      "One chat")}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                <SelectItem value={ALL_CHATS}>All chats</SelectItem>
                {history.parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          {filtering ? (
            <Button size="xs" variant="ghost-muted" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}
      {shown === null && loadError === null ? (
        <div role="status" aria-label="Loading subagents" className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-12 w-full" shape="card" />
          ))}
        </div>
      ) : shown === null ? (
        <WindowError
          message="Your subagents did not load. Check that Leonidas is running, then try again."
          onRetry={() => {
            void running.reload();
            history.reload();
          }}
        />
      ) : shown.length === 0 ? (
        filtering ? (
          <EmptyBlock
            title="No runs match"
            line="Try other words, or clear the filters."
            action={{ label: "Clear filters", onPress: clearFilters }}
          />
        ) : tab === "running" ? (
          <EmptyBlock
            {...EMPTY_RUNNING}
            action={{ label: "See history", onPress: () => switchTab("history") }}
          />
        ) : (
          <EmptyBlock {...EMPTY_HISTORY} />
        )
      ) : (
        // The window body pads its content; the two panes sit flush against its edges.
        <div
          ref={setFrame}
          onKeyDown={(event) => {
            if (event.key === "Escape" && narrow && showDetail) setDetailOpen(false);
          }}
          className="-m-4 flex h-[calc(100%+2rem)] min-h-0"
        >
          {showList ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
              {running.staleError && tab === "running" ? (
                <p role="alert" className="mb-2 px-3 text-xs text-destructive-foreground">
                  The list could not update. It shows the last answer.
                </p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {shown.map((run) => (
                  <li key={run.id}>
                    <RunRow
                      run={run}
                      now={now}
                      live={tab === "running"}
                      selected={run.id === selectedId}
                      stopping={stoppingId === run.id}
                      onSelect={() => select(run)}
                      onOpen={() => openRun(run)}
                      onStop={() => void stopRun(run)}
                    />
                  </li>
                ))}
              </ul>
              {tab === "history" && history.hasMore ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={history.loadingMore}
                    onClick={() => void history.loadMore()}
                  >
                    {history.loadingMore ? "Loading" : "Show older runs"}
                  </Button>
                </div>
              ) : null}
              {tab === "history" && history.moreError ? (
                <p role="alert" className="mt-3 text-center text-xs text-destructive-foreground">
                  More runs did not load. Try again.
                </p>
              ) : null}
            </div>
          ) : null}
          {showDetail ? (
            <div
              className={
                narrow
                  ? "flex min-h-0 min-w-0 flex-1"
                  : "flex min-h-0 w-[min(32rem,55%)] shrink-0 border-l border-border"
              }
            >
              <SubagentDetail
                key={selected.id}
                run={selected}
                now={now}
                stopping={stoppingId === selected.id}
                onBack={narrow ? () => setDetailOpen(false) : null}
                onOpenParent={() => openThread(selected.parent.id)}
                onOpenChild={() => openRun(selected)}
                onStop={() => void stopRun(selected)}
              />
            </div>
          ) : !narrow ? (
            <div className="flex min-h-0 w-[min(32rem,55%)] shrink-0 items-center justify-center border-l border-border px-6 text-center">
              <p className="text-sm text-muted-foreground">
                Pick a run to see its task and its result.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </RailWindow>
  );
}
