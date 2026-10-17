// @effect-diagnostics nodeBuiltinImport:off - file watching is a Node API.
import type { TaskBoardTask } from "@t3tools/contracts";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { type AiosCardCache, aiosTaskFolders, readAiosTasks } from "./aiosCards.ts";

/** A full rescan still runs this often, in case the system drops a watch event. */
const AIOS_RESCAN_MS = 30_000;

export interface AiosCardReader {
  /** Returns the last scan while no watched folder changed; otherwise rescans. */
  readonly read: (root: string, now: number) => ReadonlyArray<TaskBoardTask>;
  /** Forces the next read of `root` (or of every root) to rescan. Call after each card write. */
  readonly invalidate: (root?: string) => void;
  readonly close: () => void;
}

interface RootState {
  tasks: ReadonlyArray<TaskBoardTask>;
  readAt: number;
  dirty: boolean;
  /** True after a watcher failed: every read rescans, as before the watcher existed. */
  unwatched: boolean;
  readonly watchers: Map<string, NodeFS.FSWatcher>;
}

type Watch = (dir: string, onChange: () => void) => NodeFS.FSWatcher;

const defaultWatch: Watch = (dir, onChange) => NodeFS.watch(dir, { persistent: false }, onChange);

/**
 * Keeps the parsed board per AIOS root and watches each card folder (not recursive), so a read with
 * no change on disk costs no file system call.
 */
export function makeAiosCardReader(
  cache: AiosCardCache,
  options: { readonly watch?: Watch; readonly rescanMs?: number } = {},
): AiosCardReader {
  const watch = options.watch ?? defaultWatch;
  const rescanMs = options.rescanMs ?? AIOS_RESCAN_MS;
  const roots = new Map<string, RootState>();

  const closeWatchers = (state: RootState) => {
    for (const watcher of state.watchers.values()) watcher.close();
    state.watchers.clear();
  };

  // The projects folder is watched too, so a new project's task folder triggers a rescan.
  const syncWatchers = (root: string, state: RootState) => {
    if (state.unwatched) return;
    const wanted = new Set([
      NodePath.join(root, "projects"),
      ...aiosTaskFolders(root).map((folder) => folder.dir),
    ]);
    for (const [dir, watcher] of state.watchers) {
      if (!wanted.has(dir)) {
        watcher.close();
        state.watchers.delete(dir);
      }
    }
    const markDirty = () => {
      state.dirty = true;
    };
    for (const dir of wanted) {
      if (state.watchers.has(dir) || !NodeFS.existsSync(dir)) continue;
      try {
        const watcher = watch(dir, markDirty);
        watcher.on("error", () => {
          state.unwatched = true;
          closeWatchers(state);
        });
        state.watchers.set(dir, watcher);
      } catch {
        state.unwatched = true;
        closeWatchers(state);
        return;
      }
    }
  };

  return {
    read: (root, now) => {
      let state = roots.get(root);
      if (
        state &&
        !state.dirty &&
        !state.unwatched &&
        now >= state.readAt &&
        now - state.readAt < rescanMs
      ) {
        return state.tasks;
      }
      if (!state) {
        state = { tasks: [], readAt: now, dirty: false, unwatched: false, watchers: new Map() };
        roots.set(root, state);
      }
      // Watch before the scan and clear the flag first, so a change during the scan is not lost.
      state.dirty = false;
      syncWatchers(root, state);
      state.tasks = readAiosTasks(root, { now, cache });
      state.readAt = now;
      return state.tasks;
    },
    invalidate: (root) => {
      for (const [key, state] of roots) if (root === undefined || key === root) state.dirty = true;
    },
    close: () => {
      for (const state of roots.values()) closeWatchers(state);
      roots.clear();
    },
  };
}
