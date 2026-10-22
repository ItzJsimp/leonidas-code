import { create } from "zustand";

import type { ThreadPlace } from "./swapKeys";

interface TwoStateState {
  /** The optional 50/50 split: the Command Center beside the chat. */
  readonly split: boolean;
  /** The chat the swap key returns to from the Command Center. */
  readonly lastThread: ThreadPlace | null;
  readonly setSplit: (split: boolean) => void;
  readonly rememberThread: (place: ThreadPlace) => void;
}

export const useTwoStateStore = create<TwoStateState>()((set) => ({
  split: false,
  lastThread: null,
  setSplit: (split) => set({ split }),
  rememberThread: (place) =>
    set((state) =>
      state.lastThread?.environmentId === place.environmentId &&
      state.lastThread.threadId === place.threadId
        ? state
        : { lastThread: place },
    ),
}));
