import {
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { FilesListResult, StoredFile } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useAtomQueryRunner } from "~/state/use-atom-query-runner";

import type { FilesTab } from "./files.logic";
import { filesListQuery } from "./state";

const PAGE_SIZE = 48;
/** A typed search waits this long, so each key press does not read the folder. */
const SEARCH_DELAY_MS = 250;

interface Loaded {
  /** The tab these files belong to. Files of another tab are never shown. */
  readonly tab: FilesTab;
  readonly files: ReadonlyArray<StoredFile>;
  readonly nextCursor: string | null;
  readonly error: string | null;
}

function failureText(result: AtomCommandResult<unknown, unknown> & { _tag: "Failure" }): string {
  const error = squashAtomCommandFailure(result);
  return error instanceof Error ? error.message : "The files did not load.";
}

/**
 * The stored files for one tab and search, loaded a page at a time. A new tab or search starts
 * over from the newest file; `loadMore` adds the next page.
 */
export function useFilesList(tab: FilesTab, query: string) {
  const environmentId = usePrimaryEnvironmentId();
  const run = useAtomQueryRunner(filesListQuery, { reportFailure: false, refresh: true });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [counts, setCounts] = useState<FilesListResult["counts"] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloads, setReloads] = useState(0);
  // Only the newest request may write state, so a slow old answer never replaces a new one.
  const latest = useRef(0);
  const search = query.trim();

  useEffect(() => {
    if (environmentId === null) return;
    const id = ++latest.current;
    const timer = window.setTimeout(
      () => {
        void run({
          environmentId,
          input: { tab, limit: PAGE_SIZE, ...(search === "" ? {} : { query: search }) },
        }).then((result) => {
          if (id !== latest.current) return;
          if (result._tag === "Failure") {
            setLoaded({ tab, files: [], nextCursor: null, error: failureText(result) });
            return;
          }
          setLoaded({
            tab,
            files: result.value.files,
            nextCursor: result.value.nextCursor,
            error: null,
          });
          setCounts(result.value.counts);
        });
      },
      search === "" ? 0 : SEARCH_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `reloads` restarts the read on Refresh.
  }, [environmentId, run, tab, search, reloads]);

  const current = loaded?.tab === tab ? loaded : null;
  const nextCursor = current?.nextCursor ?? null;

  const loadMore = useCallback(async () => {
    if (environmentId === null || nextCursor === null || loadingMore) return;
    const id = latest.current;
    setLoadingMore(true);
    const result = await run({
      environmentId,
      input: {
        tab,
        limit: PAGE_SIZE,
        cursor: nextCursor,
        ...(search === "" ? {} : { query: search }),
      },
    });
    if (id === latest.current) {
      setLoaded((previous) => {
        if (previous === null || previous.tab !== tab) return previous;
        if (result._tag === "Failure") return { ...previous, error: failureText(result) };
        // A file listed on two pages (the folder changed in between) shows once.
        const seen = new Set(previous.files.map((file) => file.id));
        return {
          tab,
          files: [...previous.files, ...result.value.files.filter((file) => !seen.has(file.id))],
          nextCursor: result.value.nextCursor,
          error: null,
        };
      });
      if (result._tag === "Success") setCounts(result.value.counts);
    }
    setLoadingMore(false);
  }, [environmentId, loadingMore, nextCursor, run, search, tab]);

  const remove = useCallback((file: StoredFile) => {
    setLoaded((previous) =>
      previous === null
        ? previous
        : { ...previous, files: previous.files.filter((item) => item.id !== file.id) },
    );
    setCounts((previous) =>
      previous === null
        ? previous
        : {
            all: Math.max(0, previous.all - 1),
            images: Math.max(0, previous.images - (file.kind === "image" ? 1 : 0)),
            documents: Math.max(0, previous.documents - (file.kind === "image" ? 0 : 1)),
          },
    );
  }, []);

  return {
    environmentId,
    files: current?.files ?? [],
    counts,
    status:
      current === null
        ? "loading"
        : current.error !== null && current.files.length === 0
          ? "error"
          : "ready",
    error: current?.error ?? null,
    hasMore: nextCursor !== null,
    loadingMore,
    loadMore,
    reload: useCallback(() => setReloads((value) => value + 1), []),
    remove,
  } as const;
}
