import { beforeEach, describe, expect, it } from "vitest";

import { collectLeaves, MAX_PANES } from "./splitLayout";
import { useSplitLayoutStore } from "./splitLayoutStore";
import type { ThreadRouteTarget } from "./threadRoutes";

const chat = (threadId: string): ThreadRouteTarget =>
  ({ kind: "server", threadRef: { environmentId: "env", threadId } }) as ThreadRouteTarget;

const store = () => useSplitLayoutStore.getState();
const threadIds = () =>
  collectLeaves(store().root!).map((leaf) =>
    leaf.target?.kind === "server" ? leaf.target.threadRef.threadId : null,
  );

beforeEach(() => {
  useSplitLayoutStore.setState({ root: null, focusedLeafId: null });
});

describe("split layout store", () => {
  it("starts single and becomes a split when a second chat is dropped on an edge", () => {
    expect(store().root).toBeNull();
    store().addPane({ base: chat("a"), edge: "right", target: chat("b") });
    expect(threadIds()).toEqual(["a", "b"]);
    expect(
      collectLeaves(store().root!).find((leaf) => leaf.id === store().focusedLeafId)?.target,
    ).toEqual(chat("b"));
  });

  it("moves a chat that is already visible instead of duplicating it", () => {
    store().addPane({ base: chat("a"), edge: "right", target: chat("b") });
    store().addPane({ base: chat("a"), edge: "bottom", target: chat("a") });
    expect(threadIds().toSorted()).toEqual(["a", "b"]);
  });

  it("stops adding panes at the cap", () => {
    store().addPane({ base: chat("c0"), edge: "right", target: chat("c1") });
    for (let index = 2; index < MAX_PANES + 2; index += 1) {
      store().addPane({ base: chat("c0"), edge: "right", target: chat(`c${index}`) });
    }
    expect(threadIds()).toHaveLength(MAX_PANES);
  });

  it("follows the route into the focused pane, or focuses the pane already showing it", () => {
    store().addPane({ base: chat("a"), edge: "right", target: chat("b") });
    store().syncRouteTarget(chat("c"));
    expect(threadIds()).toEqual(["a", "c"]);
    store().syncRouteTarget(chat("a"));
    const focused = collectLeaves(store().root!).find((leaf) => leaf.id === store().focusedLeafId);
    expect(focused?.target).toEqual(chat("a"));
    expect(threadIds()).toEqual(["a", "c"]);
  });

  it("collapses to the single view when the second-to-last pane closes", () => {
    store().addPane({ base: chat("a"), edge: "right", target: chat("b") });
    const closing = store().focusedLeafId!;
    const result = store().closePane(closing);
    expect(store().root).toBeNull();
    expect(result?.target).toEqual(chat("a"));
  });

  it("re-tiles to a preset while keeping chats", () => {
    store().addPane({ base: chat("a"), edge: "right", target: chat("b") });
    store().applyPreset("grid-2x2", chat("a"));
    expect(threadIds()).toEqual(["a", "b", null, null]);
    store().applyPreset("columns-2", chat("a"));
    expect(threadIds()).toEqual(["a", "b"]);
  });
});
