import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";

/** Marks kept per machine; older ids drop first (ids are ULIDs, so they sort by time). */
const MAX_MARKS = 2_000;

export interface EventMark {
  readonly read?: true;
  readonly dismissed?: true;
}

interface EventFeedStoreState {
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
): Record<string, EventMark> {
  const next: Record<string, EventMark> = { ...marks };
  for (const id of ids) next[id] = { ...next[id], ...mark };
  const keys = Object.keys(next);
  if (keys.length > MAX_MARKS) {
    for (const id of keys.toSorted().slice(0, keys.length - MAX_MARKS)) delete next[id];
  }
  return next;
}

export const useEventFeedStore = create<EventFeedStoreState>()(
  persist(
    (set) => ({
      marks: {},
      mutedTypes: [],
      markRead: (ids) => set((state) => ({ marks: withMarks(state.marks, ids, { read: true }) })),
      dismiss: (id) =>
        set((state) => ({ marks: withMarks(state.marks, [id], { read: true, dismissed: true }) })),
      toggleMuted: (type) =>
        set((state) => ({
          mutedTypes: state.mutedTypes.includes(type)
            ? state.mutedTypes.filter((muted) => muted !== type)
            : [...state.mutedTypes, type],
        })),
    }),
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
