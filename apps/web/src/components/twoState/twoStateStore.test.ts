import { describe, expect, it } from "vite-plus/test";

import { SHELL_LAYOUT_STORAGE_KEY, useTwoStateStore } from "./twoStateStore";

describe("shell layout store", () => {
  it("starts on one full page, half and half when split, with the chat list open", () => {
    const { split, ratio, chatListOpen, lastThread, leftPage } = useTwoStateStore.getState();
    expect({ split, ratio, chatListOpen, lastThread, leftPage }).toEqual({
      split: false,
      ratio: 0.5,
      chatListOpen: true,
      lastThread: null,
      leftPage: null,
    });
  });

  it("keeps the layout under the versioned key and remembers the last chat and page", () => {
    const place = { environmentId: "env", threadId: "thr" };
    const page = { path: "/inbox", tab: null };
    useTwoStateStore.getState().setRatio(0.4);
    useTwoStateStore.getState().rememberThread(place);
    useTwoStateStore.getState().rememberLeftPage(page);
    expect(SHELL_LAYOUT_STORAGE_KEY).toBe("leonidas:shell-layout:v1");
    expect(useTwoStateStore.persist.getOptions().partialize?.(useTwoStateStore.getState())).toEqual(
      { split: false, ratio: 0.4, chatListOpen: true, lastThread: place, leftPage: page },
    );
  });

  it("turns the split off once for a layout saved by version 1", () => {
    const migrate = useTwoStateStore.persist.getOptions().migrate;
    expect(migrate?.({ split: true, ratio: 0.3 }, 1)).toEqual({ split: false, ratio: 0.3 });
    expect(migrate?.({ split: true, ratio: 0.3 }, 2)).toEqual({ split: true, ratio: 0.3 });
  });
});
