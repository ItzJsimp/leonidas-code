import {
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { SubagentRun, SubagentRunStatus } from "@t3tools/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useAtomQueryRunner } from "~/state/use-atom-query-runner";

import { parentChats } from "./subagents.logic";
import { subagentRunsQuery } from "./state";

/** The Running tab asks again this often, and only while the page is on screen. */
const POLL_MS = 5_000;
const RUNNING_LIMIT = 200;
const HISTORY_PAGE = 50;
const SEARCH_DELAY_MS = 250;

function failureText(result: AtomCommandResult<unknown, unknown> & { _tag: "Failure" }): string {
  const error = squashAtomCommandFailure(result);
  return error instanceof Error ? error.message : "The subagents did not load.";
}

/**
 * Live subagent runs. The server derives each status from the stored run events, so this only
 * asks again every 5 seconds while the page is visible, and at once when it becomes visible.
 */
export function useRunningRuns() {
  const environmentId = usePrimaryEnvironmentId();
  const run = useAtomQueryRunner(subagentRunsQuery, { reportFailure: false, refresh: true });
  const [runs, setRuns] = useState<ReadonlyArray<SubagentRun> | null>(null);
  const [runningCount, setRunningCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (environmentId === null) return;
    const id = ++latest.current;
    const result = await run({
      environmentId,
      input: { scope: "running", limit: RUNNING_LIMIT },
    });
    if (id !== latest.current) return;
    if (result._tag === "Failure") {
      setError(failureText(result));
      return;
    }
    setRuns(result.value.runs);
    setRunningCount(result.value.runningCount);
    setError(null);
    setUpdatedAt(Date.now());
  }, [environmentId, run]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  // A run that ended leaves this list, so the History tab asks again when the set changes.
  const signature = useMemo(() => (runs ?? []).map((item) => item.id).join(","), [runs]);

  return {
    environmentId,
    runs,
    runningCount,
    error: runs === null ? error : null,
    staleError: runs === null ? null : error,
    updatedAt,
    signature,
    reload: load,
  } as const;
}

export interface HistoryFilters {
  readonly status: Exclude<SubagentRunStatus, "running" | "waiting"> | null;
  readonly parentThreadId: string | null;
  readonly query: string;
}

/** Finished runs, newest first, a page at a time, with the filters the server applies. */
export function useHistoryRuns(enabled: boolean, filters: HistoryFilters, refreshKey: string) {
  const environmentId = usePrimaryEnvironmentId();
  const run = useAtomQueryRunner(subagentRunsQuery, { reportFailure: false, refresh: true });
  const [runs, setRuns] = useState<ReadonlyArray<SubagentRun> | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [known, setKnown] = useState<ReadonlyArray<SubagentRun["parent"]>>([]);
  const [reloads, setReloads] = useState(0);
  const latest = useRef(0);
  const query = filters.query.trim();

  const input = useMemo(
    () => ({
      scope: "history" as const,
      limit: HISTORY_PAGE,
      ...(filters.status === null ? {} : { status: filters.status }),
      ...(filters.parentThreadId === null
        ? {}
        : { parentThreadId: filters.parentThreadId as SubagentRun["parent"]["id"] }),
      ...(query === "" ? {} : { query }),
    }),
    [filters.parentThreadId, filters.status, query],
  );

  useEffect(() => {
    if (!enabled || environmentId === null) return;
    const id = ++latest.current;
    const timer = window.setTimeout(
      () => {
        void run({ environmentId, input }).then((result) => {
          if (id !== latest.current) return;
          if (result._tag === "Failure") {
            setError(failureText(result));
            return;
          }
          setRuns(result.value.runs);
          setNextCursor(result.value.nextCursor);
          setError(null);
          setKnown((previous) =>
            parentChats([...previous.map((parent) => ({ parent })), ...result.value.runs]),
          );
        });
      },
      query === "" ? 0 : SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `refreshKey` and `reloads` restart the read.
  }, [enabled, environmentId, input, query, refreshKey, reloads, run]);

  const loadMore = useCallback(async () => {
    if (environmentId === null || nextCursor === null || loadingMore) return;
    const id = latest.current;
    setLoadingMore(true);
    const result = await run({ environmentId, input: { ...input, cursor: nextCursor } });
    if (id === latest.current) {
      if (result._tag === "Failure") {
        setError(failureText(result));
      } else {
        setRuns((previous) => {
          const seen = new Set((previous ?? []).map((item) => item.id));
          return [...(previous ?? []), ...result.value.runs.filter((item) => !seen.has(item.id))];
        });
        setNextCursor(result.value.nextCursor);
        setKnown((previous) =>
          parentChats([...previous.map((parent) => ({ parent })), ...result.value.runs]),
        );
        setError(null);
      }
    }
    setLoadingMore(false);
  }, [environmentId, input, loadingMore, nextCursor, run]);

  return {
    environmentId,
    runs,
    parents: known,
    error: runs === null ? error : null,
    moreError: runs === null ? null : error,
    hasMore: nextCursor !== null,
    loadingMore,
    loadMore,
    reload: useCallback(() => setReloads((value) => value + 1), []),
  } as const;
}
