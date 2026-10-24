// @effect-diagnostics nodeBuiltinImport:off - file watching is a Node API.
// @effect-diagnostics globalTimers:off - a short debounce and a rescan timer, owned by this plain module.
import {
  type FeedBadLine,
  type FeedEvent,
  type FeedUpdate,
  waitsForUser,
} from "@t3tools/contracts";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { FEED_DIR, type FeedCursor, foldDedupe, readFeedFrom } from "./feedFile.ts";

/** A full rescan still runs this often, in case the system drops a watch event. */
const FEED_RESCAN_MS = 30_000;
/** A Git pull can write many lines at once; one read covers the burst. */
const FEED_DEBOUNCE_MS = 150;
/** Month files loaded at start; the AI searches older months on request. */
const FEED_MONTHS = 2;
const FEED_MAX_EVENTS = 1_000;
/** Unreadable-line reports sent per update; a garbage file must not flood the socket. */
const FEED_MAX_BAD = 50;
const MONTH_FILE = /^\d{4}-\d{2}\.jsonl$/;

export interface EventFeed {
  /** Calls `onUpdate` once with the snapshot, then after each change. Returns the unsubscribe. */
  readonly subscribe: (root: string, onUpdate: (update: FeedUpdate) => void) => () => void;
  readonly close: () => void;
}

type Watch = (dir: string, onChange: () => void) => NodeFS.FSWatcher;

const defaultWatch: Watch = (dir, onChange) => NodeFS.watch(dir, { persistent: false }, onChange);

interface RootState {
  readonly listeners: Set<(update: FeedUpdate) => void>;
  readonly cursors: Map<string, FeedCursor>;
  readonly ids: Set<string>;
  events: Array<FeedEvent>;
  counts: Map<string, number>;
  /** Unreadable lines from the first scan, so each new subscriber sees them. */
  startBad: ReadonlyArray<FeedBadLine>;
  watcher: NodeFS.FSWatcher | null;
  debounce: ReturnType<typeof setTimeout> | null;
  readonly rescan: ReturnType<typeof setInterval>;
}

export function makeEventFeed(
  options: {
    readonly watch?: Watch;
    readonly rescanMs?: number;
    readonly debounceMs?: number;
  } = {},
): EventFeed {
  const watch = options.watch ?? defaultWatch;
  const debounceMs = options.debounceMs ?? FEED_DEBOUNCE_MS;
  const roots = new Map<string, RootState>();

  /** Reads new bytes from the tracked month files and any newer ones. */
  const scan = (root: string, state: RootState) => {
    const dir = NodePath.join(root, FEED_DIR);
    let names: string[];
    try {
      names = NodeFS.readdirSync(dir)
        .filter((name) => MONTH_FILE.test(name))
        .toSorted();
    } catch {
      return { events: [], bad: [] };
    }
    const oldestTracked = [...state.cursors.keys()]
      .map((file) => NodePath.basename(file))
      .toSorted()[0];
    const wanted = oldestTracked
      ? names.filter((name) => name >= oldestTracked)
      : names.slice(-FEED_MONTHS);
    const events: FeedEvent[] = [];
    const bad: FeedBadLine[] = [];
    for (const name of wanted) {
      const file = NodePath.join(dir, name);
      const read = readFeedFrom(file, state.cursors.get(file) ?? { offset: 0, line: 0 });
      state.cursors.set(file, read.cursor);
      bad.push(...read.bad.slice(0, FEED_MAX_BAD - bad.length));
      for (const event of read.events) {
        if (state.ids.has(event.id)) continue;
        state.ids.add(event.id);
        events.push(event);
      }
    }
    if (state.watcher === null) {
      try {
        state.watcher = watch(dir, () => schedule(root, state));
        state.watcher.on("error", () => {
          state.watcher?.close();
          state.watcher = null;
        });
      } catch {
        state.watcher = null;
      }
    }
    return { events, bad };
  };

  const refold = (state: RootState, added: ReadonlyArray<FeedEvent>) => {
    state.events.push(...added);
    if (state.events.length > FEED_MAX_EVENTS) {
      const cut = state.events.length - FEED_MAX_EVENTS;
      let waiters = 0;
      const kept = new Set<string>();
      for (let index = state.events.length - 1; index >= 0; index--) {
        const event = state.events[index]!;
        const waiting = waitsForUser(event) && ++waiters <= 1_000;
        if (index >= cut || waiting) kept.add(event.id);
      }
      state.events = state.events.filter((event) => kept.has(event.id));
    }
    const folded = foldDedupe(state.events);
    const changed = folded.filter((event) => state.counts.get(event.id) !== event.count);
    state.counts = new Map(folded.map((event) => [event.id, event.count]));
    return { folded, changed };
  };

  const update = (root: string, state: RootState) => {
    const { events, bad } = scan(root, state);
    if (events.length === 0 && bad.length === 0) return;
    const { changed } = refold(state, events);
    if (changed.length === 0 && bad.length === 0) return;
    for (const listener of state.listeners) listener({ kind: "upsert", events: changed, bad });
  };

  function schedule(root: string, state: RootState) {
    if (state.debounce !== null) return;
    state.debounce = setTimeout(() => {
      state.debounce = null;
      update(root, state);
    }, debounceMs);
  }

  const stop = (root: string, state: RootState) => {
    state.watcher?.close();
    if (state.debounce !== null) clearTimeout(state.debounce);
    clearInterval(state.rescan);
    roots.delete(root);
  };

  return {
    subscribe: (root, onUpdate) => {
      let state = roots.get(root);
      if (!state) {
        const rescan = setInterval(() => update(root, state!), options.rescanMs ?? FEED_RESCAN_MS);
        rescan.unref?.();
        state = {
          listeners: new Set(),
          cursors: new Map(),
          ids: new Set(),
          events: [],
          counts: new Map(),
          startBad: [],
          watcher: null,
          debounce: null,
          rescan,
        };
        roots.set(root, state);
        const { events, bad } = scan(root, state);
        refold(state, events);
        state.startBad = bad;
      }
      const current = state;
      current.listeners.add(onUpdate);
      onUpdate({ kind: "snapshot", events: foldDedupe(current.events), bad: current.startBad });
      return () => {
        current.listeners.delete(onUpdate);
        if (current.listeners.size === 0) stop(root, current);
      };
    },
    close: () => {
      for (const [root, state] of roots) stop(root, state);
    },
  };
}
