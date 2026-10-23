import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "~/lib/storage";

import type { ThreadPlace } from "./swapKeys";

export const SHELL_LAYOUT_STORAGE_KEY = "leonidas:shell-layout:v1";

interface TwoStateState {
  /** Command Center (or a rail window) beside the chat when the window is wide enough. */
  readonly split: boolean;
  /** The left pane's share of the width, 0 to 1. */
  readonly ratio: number;
  /** The chat list column at the chat pane's left edge. */
  readonly chatListOpen: boolean;
  /** The chat the rail's Chat icon and the swap key return to. */
  readonly lastThread: ThreadPlace | null;
  readonly setSplit: (split: boolean) => void;
  readonly setRatio: (ratio: number) => void;
  readonly setChatListOpen: (open: boolean) => void;
  readonly rememberThread: (place: ThreadPlace) => void;
}

export const useTwoStateStore = create<TwoStateState>()(
  persist(
    (set) => ({
      split: true,
      ratio: 0.5,
      chatListOpen: true,
      lastThread: null,
      setSplit: (split) => set({ split }),
      setRatio: (ratio) => set({ ratio }),
      setChatListOpen: (chatListOpen) => set({ chatListOpen }),
      rememberThread: (place) =>
        set((state) =>
          state.lastThread?.environmentId === place.environmentId &&
          state.lastThread.threadId === place.threadId
            ? state
            : { lastThread: place },
        ),
    }),
    {
      name: SHELL_LAYOUT_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: ({ split, ratio, chatListOpen, lastThread }) => ({
        split,
        ratio,
        chatListOpen,
        lastThread,
      }),
    },
  ),
);
