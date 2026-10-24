import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";

/** Old absent ids drop first; marks for events still in a feed always stay. */
const MAX_MARKS = 2_000;

export interface EventMark {
  readonly read?: true;
  readonly dismissed?: true;
}

interface EventFeedStoreState {
  readonly setFeedIds: (environmentId: string, ids: ReadonlyArray<string> | null) => void;
  /** Read and dismissed state, keyed by event id. Never written to the AIOS. */
  readonly marks: Readonly<Record<string, EventMark>>;
  /** Event types that never pop up. They still show in the inbox. */
  readonly mutedTypes: ReadonlyArray<string>;
  readonly markRead: (ids: ReadonlyArray<string>) => void;
  readonly dismiss: (id: string) => void;
  readonly toggleMuted: (type: string) => void;
}

function withMarks(
  marks: Readonly<Record<string, EventMark>>,
  ids: ReadonlyArray<string>,
  mark: EventMark,
  feedIds: ReadonlyMap<string, ReadonlyArray<string>>,
): Record<string, EventMark> {
  const next: Record<string, EventMark> = { ...marks };
  for (const id of ids) next[id] = { ...next[id], ...mark };
  const keys = Object.keys(next);
  if (keys.length > MAX_MARKS) {
    const retained = new Set([...feedIds.values()].flat());
    const absent = keys.filter((id) => !retained.has(id)).sort();
    for (const id of absent.slice(0, keys.length - MAX_MARKS)) delete next[id];
  }
  return next;
}

export const useEventFeedStore = create<EventFeedStoreState>()(
  persist(
    (set) => {
      const feedIds = new Map<string, ReadonlyArray<string>>();
      return {
        marks: {},
        mutedTypes: [],
        setFeedIds: (environmentId, ids) => {
          if (ids === null) feedIds.delete(environmentId);
          else feedIds.set(environmentId, ids);
        },
        markRead: (ids) =>
          set((state) => ({ marks: withMarks(state.marks, ids, { read: true }, feedIds) })),
        dismiss: (id) =>
          set((state) => ({
            marks: withMarks(state.marks, [id], { read: true, dismissed: true }, feedIds),
          })),
        toggleMuted: (type) =>
          set((state) => ({
            mutedTypes: state.mutedTypes.includes(type)
              ? state.mutedTypes.filter((muted) => muted !== type)
              : [...state.mutedTypes, type],
          })),
      };
    },
    {
      name: "leonidas:event-feed:v1",
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      version: 1,
      partialize: ({ marks, mutedTypes }) => ({ marks, mutedTypes }),
    },
  ),
);
