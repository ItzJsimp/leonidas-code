import { create } from "zustand";

import type { ThreadPlace } from "./swapKeys";

interface TwoStateState {
  /** The optional 50/50 split: the Command Center beside the chat. */
  readonly split: boolean;
  /** The chat the swap key returns to from the Command Center. */
  readonly lastThread: ThreadPlace | null;
  /** When this app saw a finished turn write each area, in ms. */
  readonly touchedAt: Readonly<Record<string, number>>;
  readonly setSplit: (split: boolean) => void;
  readonly markTouched: (areas: ReadonlyArray<string>, at: number) => void;
  readonly rememberThread: (place: ThreadPlace) => void;
}

export const useTwoStateStore = create<TwoStateState>()((set) => ({
  split: false,
  lastThread: null,
  touchedAt: {},
  setSplit: (split) => set({ split }),
  markTouched: (areas, at) =>
    set((state) => ({
      touchedAt: { ...state.touchedAt, ...Object.fromEntries(areas.map((area) => [area, at])) },
    })),
  rememberThread: (place) =>
    set((state) =>
      state.lastThread?.environmentId === place.environmentId &&
      state.lastThread.threadId === place.threadId
        ? state
        : { lastThread: place },
    ),
}));
