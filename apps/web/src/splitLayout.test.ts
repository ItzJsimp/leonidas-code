import { describe, expect, it } from "vite-plus/test";

import {
  applyPreset,
  collectLeaves,
  computeDividers,
  computeRects,
  countLeaves,
  createLeaf,
  dropZonePreview,
  findNeighbor,
  leavesInReadingOrder,
  matchPreset,
  moveLeaf,
  removeLeaf,
  resolveDropZone,
  setSplitRatio,
  splitLeaf,
  type SplitNode,
} from "./splitLayout";
import type { ThreadRouteTarget } from "./threadRoutes";

const target = (threadId: string): ThreadRouteTarget =>
  ({
    kind: "server",
    threadRef: { environmentId: "env", threadId },
  }) as ThreadRouteTarget;

const ids = (node: SplitNode) => collectLeaves(node).map((leaf) => leaf.id);

describe("splitLayout tree", () => {
  it("splits a leaf toward the dropped edge", () => {
    const a = createLeaf(target("a"), "a");
    const b = createLeaf(target("b"), "b");
    const left = splitLeaf(a, "a", "left", b);
    expect(computeRects(left).get("b")).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
    expect(computeRects(left).get("a")).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
    const bottom = splitLeaf(a, "a", "bottom", b);
    expect(computeRects(bottom).get("b")).toEqual({ x: 0, y: 0.5, w: 1, h: 0.5 });
  });

  it("gives a removed pane's space to its sibling and empties on the last pane", () => {
    const a = createLeaf(null, "a");
    const tree = splitLeaf(a, "a", "right", createLeaf(null, "b"));
    const after = removeLeaf(tree, "a");
    expect(after && countLeaves(after)).toBe(1);
    expect(after && computeRects(after).get("b")).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(removeLeaf(createLeaf(null, "only"), "only")).toBeNull();
  });

  it("clamps resize ratios so a pane never collapses", () => {
    const tree = splitLeaf(createLeaf(null, "a"), "a", "right", createLeaf(null, "b"));
    const divider = computeDividers(tree)[0]!;
    const squeezed = setSplitRatio(tree, divider.splitId, 0.01);
    expect(computeDividers(squeezed)[0]!.ratio).toBe(0.15);
  });

  it("finds the neighbor with the largest shared border and swaps without changing ids", () => {
    // a | (b over c)
    const tree = applyPreset(null, "main-right");
    const [a, b, c] = leavesInReadingOrder(tree);
    expect(findNeighbor(tree, b!.id, "left")?.id).toBe(a!.id);
    expect(findNeighbor(tree, b!.id, "down")?.id).toBe(c!.id);
    expect(findNeighbor(tree, b!.id, "right")).toBeNull();
    const moved = moveLeaf(tree, a!.id, "right");
    expect(ids(moved).sort()).toEqual(ids(tree).sort());
    expect(computeRects(moved).get(a!.id)!.x).toBeGreaterThan(0.4);
  });
});

describe("layout presets", () => {
  it("builds even columns, rows and a grid", () => {
    const columns = computeRects(applyPreset(null, "columns-3"));
    expect([...columns.values()].map((rect) => rect.w.toFixed(3))).toEqual([
      "0.333",
      "0.333",
      "0.333",
    ]);
    const grid = applyPreset(null, "grid-2x2");
    expect(countLeaves(grid)).toBe(4);
    expect([...computeRects(grid).values()].every((rect) => rect.w === 0.5 && rect.h === 0.5)).toBe(
      true,
    );
  });

  it("keeps chats in reading order and reuses pane ids when re-tiling", () => {
    const start = applyPreset(null, "grid-2x2");
    const [a, b, c, d] = leavesInReadingOrder(start);
    const filled = [a, b, c, d].reduce<SplitNode>(
      (tree, leaf, index) => replaceTarget(tree, leaf!.id, `t${index}`),
      start,
    );
    const columns = applyPreset(filled, "columns-2");
    const kept = collectLeaves(columns);
    expect(kept.map((leaf) => leaf.id)).toEqual([a!.id, b!.id]);
    expect(
      kept.map((leaf) => leaf.target?.kind === "server" && leaf.target.threadRef.threadId),
    ).toEqual(["t0", "t1"]);
  });

  it("adds empty panes when growing and recognizes the active preset", () => {
    const grown = applyPreset(createLeaf(target("a"), "a"), "columns-3");
    expect(collectLeaves(grown).map((leaf) => leaf.target === null)).toEqual([false, true, true]);
    expect(matchPreset(grown)).toBe("columns-3");
    expect(matchPreset(null)).toBe("single");
    expect(matchPreset(setSplitRatio(grown, computeDividers(grown)[0]!.splitId, 0.7))).toBeNull();
  });
});

function replaceTarget(tree: SplitNode, leafId: string, threadId: string): SplitNode {
  if (tree.type === "leaf") {
    return tree.id === leafId ? { ...tree, target: target(threadId) } : tree;
  }
  return {
    ...tree,
    first: replaceTarget(tree.first, leafId, threadId),
    second: replaceTarget(tree.second, leafId, threadId),
  };
}

describe("drop zones", () => {
  const rect = { left: 100, top: 0, width: 800, height: 600 };
  it("snaps to the nearest edge and replaces in the middle", () => {
    expect(resolveDropZone(rect, { x: 120, y: 300 }, { canSplit: true })).toBe("left");
    expect(resolveDropZone(rect, { x: 880, y: 300 }, { canSplit: true })).toBe("right");
    expect(resolveDropZone(rect, { x: 500, y: 20 }, { canSplit: true })).toBe("top");
    expect(resolveDropZone(rect, { x: 500, y: 590 }, { canSplit: true })).toBe("bottom");
    expect(resolveDropZone(rect, { x: 500, y: 300 }, { canSplit: true })).toBe("replace");
  });

  it("never offers a split that makes panes too small or beyond the cap", () => {
    expect(resolveDropZone(rect, { x: 120, y: 300 }, { canSplit: false })).toBe("replace");
    const narrow = { left: 0, top: 0, width: 500, height: 600 };
    expect(resolveDropZone(narrow, { x: 10, y: 300 }, { canSplit: true })).not.toBe("left");
    const tiny = { left: 0, top: 0, width: 500, height: 400 };
    expect(resolveDropZone(tiny, { x: 10, y: 200 }, { canSplit: true })).toBe("replace");
  });

  it("previews the half a split would occupy", () => {
    expect(dropZonePreview(rect, "right")).toEqual({ left: 500, top: 0, width: 400, height: 600 });
    expect(dropZonePreview(rect, "top")).toEqual({ left: 100, top: 0, width: 800, height: 300 });
    expect(dropZonePreview(rect, "replace")).toBe(rect);
  });
});
