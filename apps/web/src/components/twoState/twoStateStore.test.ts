import { describe, expect, it } from "vite-plus/test";

import { SHELL_LAYOUT_STORAGE_KEY, useTwoStateStore } from "./twoStateStore";

describe("shell layout store", () => {
  it("starts split, half and half, with the chat list open", () => {
    const { split, ratio, chatListOpen, lastThread } = useTwoStateStore.getState();
    expect({ split, ratio, chatListOpen, lastThread }).toEqual({
      split: true,
      ratio: 0.5,
      chatListOpen: true,
      lastThread: null,
    });
  });

  it("keeps the layout under the versioned key and remembers the last chat", () => {
    const place = { environmentId: "env", threadId: "thr" };
    useTwoStateStore.getState().setRatio(0.4);
    useTwoStateStore.getState().rememberThread(place);
    expect(SHELL_LAYOUT_STORAGE_KEY).toBe("leonidas:shell-layout:v1");
    expect(useTwoStateStore.getState()).toMatchObject({ ratio: 0.4, lastThread: place });
    expect(useTwoStateStore.persist.getOptions().partialize?.(useTwoStateStore.getState())).toEqual(
      { split: true, ratio: 0.4, chatListOpen: true, lastThread: place },
    );
  });
});
