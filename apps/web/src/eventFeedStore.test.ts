import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useEventFeedStore } from "./eventFeedStore";

describe("event feed store", () => {
  beforeEach(() => useEventFeedStore.setState({ marks: {}, mutedTypes: [] }));

  it("keys read and dismissed state by event id", () => {
    const store = useEventFeedStore.getState();
    store.markRead(["evt_A"]);
    store.dismiss("evt_B");
    expect(useEventFeedStore.getState().marks).toEqual({
      evt_A: { read: true },
      evt_B: { read: true, dismissed: true },
    });
  });

  it("drops the oldest ids past 2000 marks", () => {
    const ids = Array.from({ length: 2001 }, (_, i) => `evt_${String(i).padStart(5, "0")}`);
    useEventFeedStore.getState().markRead(ids);
    const marks = useEventFeedStore.getState().marks;
    expect(Object.keys(marks)).toHaveLength(2000);
    expect(marks.evt_00000).toBeUndefined();
  });

  it("toggles a muted type", () => {
    useEventFeedStore.getState().toggleMuted("script.failed");
    expect(useEventFeedStore.getState().mutedTypes).toEqual(["script.failed"]);
    useEventFeedStore.getState().toggleMuted("script.failed");
    expect(useEventFeedStore.getState().mutedTypes).toEqual([]);
  });
});
