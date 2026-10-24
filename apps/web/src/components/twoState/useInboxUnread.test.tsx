// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const events = [{ id: "a" }, { id: "b" }, { id: "c" }];
vi.mock("~/components/workspace/useActiveAiosWorkspace", () => ({
  useActiveAiosWorkspace: () => ({ environmentId: "env-1", scopeReady: true, scope: {} }),
}));
vi.mock("~/state/eventFeed", () => ({ eventFeedLive: () => "feed-query" }));
vi.mock("~/state/query", () => ({
  useEnvironmentQuery: (query: unknown) => ({ data: query === null ? undefined : { events } }),
}));

import { useEventFeedStore } from "~/eventFeedStore";
import { useInboxUnread } from "./useInboxUnread";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useInboxUnread", () => {
  it("counts feed events that are neither read nor dismissed, and updates on a mark", () => {
    let seen = -1;
    function Probe() {
      seen = useInboxUnread();
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));
    expect(seen).toBe(3);

    act(() => useEventFeedStore.getState().markRead(["a"]));
    expect(seen).toBe(2);
    act(() => useEventFeedStore.getState().dismiss("b"));
    expect(seen).toBe(1);
    act(() => root.unmount());
  });
});
