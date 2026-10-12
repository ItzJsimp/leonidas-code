/**
 * Pure model for the split chat workspace: a binary tree of panes.
 *
 * A `row` split puts its children side by side (first = left); a `column`
 * split stacks them (first = top). The renderer never nests DOM per split. It
 * flattens the tree into one keyed list of rectangles (`computeRects`), so
 * moving, resizing or re-tiling panes only changes styles and never remounts a
 * running chat.
 */
import type { ThreadRouteTarget } from "./threadRoutes";

export type SplitDirection = "row" | "column";
export type SplitEdge = "left" | "right" | "top" | "bottom";
export type DropZone = SplitEdge | "replace";

export interface SplitLeaf {
  readonly type: "leaf";
  readonly id: string;
  /** `null` is an empty pane waiting for a chat. */
  readonly target: ThreadRouteTarget | null;
}

export interface SplitBranch {
  readonly type: "split";
  readonly id: string;
  readonly direction: SplitDirection;
  /** Share of the region given to `first`. */
  readonly ratio: number;
  readonly first: SplitNode;
  readonly second: SplitNode;
}

export type SplitNode = SplitLeaf | SplitBranch;

/** Fractions of the workspace, 0..1. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const MAX_PANES = 6;
export const MIN_RATIO = 0.15;
export const MIN_PANE_WIDTH_PX = 320;
export const MIN_PANE_HEIGHT_PX = 260;

const EPSILON = 1e-6;

let idCounter = 0;
export function createSplitId(prefix: "leaf" | "split" = "leaf"): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function createLeaf(
  target: ThreadRouteTarget | null,
  id: string = createSplitId("leaf"),
): SplitLeaf {
  return { type: "leaf", id, target };
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, ratio));
}

export function sameTarget(a: ThreadRouteTarget | null, b: ThreadRouteTarget | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "server" && b.kind === "server") {
    return (
      a.threadRef.environmentId === b.threadRef.environmentId &&
      a.threadRef.threadId === b.threadRef.threadId
    );
  }
  if (a.kind === "draft" && b.kind === "draft") return a.draftId === b.draftId;
  return false;
}

export function collectLeaves(node: SplitNode): SplitLeaf[] {
  if (node.type === "leaf") return [node];
  return [...collectLeaves(node.first), ...collectLeaves(node.second)];
}

export function countLeaves(node: SplitNode | null): number {
  return node === null ? 0 : collectLeaves(node).length;
}

export function findLeaf(node: SplitNode, leafId: string): SplitLeaf | null {
  return collectLeaves(node).find((leaf) => leaf.id === leafId) ?? null;
}

export function findLeafByTarget(node: SplitNode, target: ThreadRouteTarget): SplitLeaf | null {
  return collectLeaves(node).find((leaf) => sameTarget(leaf.target, target)) ?? null;
}

export function computeRects(
  node: SplitNode,
  region: Rect = { x: 0, y: 0, w: 1, h: 1 },
): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  const visit = (current: SplitNode, bounds: Rect) => {
    if (current.type === "leaf") {
      rects.set(current.id, bounds);
      return;
    }
    const [first, second] = splitRegion(bounds, current.direction, current.ratio);
    visit(current.first, first);
    visit(current.second, second);
  };
  visit(node, region);
  return rects;
}

function splitRegion(bounds: Rect, direction: SplitDirection, ratio: number): [Rect, Rect] {
  if (direction === "row") {
    const firstWidth = bounds.w * ratio;
    return [
      { ...bounds, w: firstWidth },
      { ...bounds, x: bounds.x + firstWidth, w: bounds.w - firstWidth },
    ];
  }
  const firstHeight = bounds.h * ratio;
  return [
    { ...bounds, h: firstHeight },
    { ...bounds, y: bounds.y + firstHeight, h: bounds.h - firstHeight },
  ];
}

export interface SplitDivider {
  readonly splitId: string;
  readonly direction: SplitDirection;
  /** The region this split divides; a pointer position maps to a ratio inside it. */
  readonly region: Rect;
  readonly ratio: number;
}

export function computeDividers(
  node: SplitNode,
  region: Rect = { x: 0, y: 0, w: 1, h: 1 },
): SplitDivider[] {
  if (node.type === "leaf") return [];
  const [first, second] = splitRegion(region, node.direction, node.ratio);
  return [
    { splitId: node.id, direction: node.direction, region, ratio: node.ratio },
    ...computeDividers(node.first, first),
    ...computeDividers(node.second, second),
  ];
}

/** Panes in reading order: top to bottom, then left to right. */
export function leavesInReadingOrder(node: SplitNode): SplitLeaf[] {
  const rects = computeRects(node);
  return collectLeaves(node).toSorted((a, b) => {
    const ra = rects.get(a.id)!;
    const rb = rects.get(b.id)!;
    if (Math.abs(ra.y - rb.y) > EPSILON) return ra.y - rb.y;
    return ra.x - rb.x;
  });
}

function mapLeaf(node: SplitNode, leafId: string, replace: (leaf: SplitLeaf) => SplitNode) {
  const visit = (current: SplitNode): SplitNode => {
    if (current.type === "leaf") return current.id === leafId ? replace(current) : current;
    const first = visit(current.first);
    const second = visit(current.second);
    return first === current.first && second === current.second
      ? current
      : { ...current, first, second };
  };
  return visit(node);
}

export function setLeafTarget(
  root: SplitNode,
  leafId: string,
  target: ThreadRouteTarget | null,
): SplitNode {
  return mapLeaf(root, leafId, (leaf) =>
    sameTarget(leaf.target, target) ? leaf : { ...leaf, target },
  );
}

export function setSplitRatio(root: SplitNode, splitId: string, ratio: number): SplitNode {
  const next = clampRatio(ratio);
  const visit = (current: SplitNode): SplitNode => {
    if (current.type === "leaf") return current;
    if (current.id === splitId) {
      return Math.abs(current.ratio - next) < EPSILON ? current : { ...current, ratio: next };
    }
    const first = visit(current.first);
    const second = visit(current.second);
    return first === current.first && second === current.second
      ? current
      : { ...current, first, second };
  };
  return visit(root);
}

/** Splits `leafId` along `edge`; the new leaf takes the edge side. */
export function splitLeaf(
  root: SplitNode,
  leafId: string,
  edge: SplitEdge,
  newLeaf: SplitLeaf,
): SplitNode {
  const direction: SplitDirection = edge === "left" || edge === "right" ? "row" : "column";
  const newFirst = edge === "left" || edge === "top";
  return mapLeaf(root, leafId, (leaf) => ({
    type: "split",
    id: createSplitId("split"),
    direction,
    ratio: 0.5,
    first: newFirst ? newLeaf : leaf,
    second: newFirst ? leaf : newLeaf,
  }));
}

/** Removes a pane; its sibling takes the freed space. `null` when nothing is left. */
export function removeLeaf(root: SplitNode, leafId: string): SplitNode | null {
  const visit = (current: SplitNode): SplitNode | null => {
    if (current.type === "leaf") return current.id === leafId ? null : current;
    const first = visit(current.first);
    const second = visit(current.second);
    if (first === null) return second;
    if (second === null) return first;
    return first === current.first && second === current.second
      ? current
      : { ...current, first, second };
  };
  return visit(root);
}

export type MoveDirection = "left" | "right" | "up" | "down";

/** The pane touching `leafId` on the given side, preferring the largest shared border. */
export function findNeighbor(
  root: SplitNode,
  leafId: string,
  direction: MoveDirection,
): SplitLeaf | null {
  const rects = computeRects(root);
  const source = rects.get(leafId);
  if (!source) return null;
  let best: { leaf: SplitLeaf; overlap: number } | null = null;
  for (const leaf of collectLeaves(root)) {
    if (leaf.id === leafId) continue;
    const rect = rects.get(leaf.id)!;
    const horizontal = direction === "left" || direction === "right";
    const touches =
      direction === "left"
        ? Math.abs(rect.x + rect.w - source.x) < EPSILON
        : direction === "right"
          ? Math.abs(source.x + source.w - rect.x) < EPSILON
          : direction === "up"
            ? Math.abs(rect.y + rect.h - source.y) < EPSILON
            : Math.abs(source.y + source.h - rect.y) < EPSILON;
    if (!touches) continue;
    const overlap = horizontal
      ? Math.min(source.y + source.h, rect.y + rect.h) - Math.max(source.y, rect.y)
      : Math.min(source.x + source.w, rect.x + rect.w) - Math.max(source.x, rect.x);
    if (overlap > EPSILON && (best === null || overlap > best.overlap)) best = { leaf, overlap };
  }
  return best?.leaf ?? null;
}

/** Swaps two panes' positions. Pane identity moves with the chat, so nothing remounts. */
export function swapLeaves(root: SplitNode, aId: string, bId: string): SplitNode {
  const a = findLeaf(root, aId);
  const b = findLeaf(root, bId);
  if (!a || !b || aId === bId) return root;
  const visit = (current: SplitNode): SplitNode => {
    if (current.type === "leaf") return current.id === aId ? b : current.id === bId ? a : current;
    return { ...current, first: visit(current.first), second: visit(current.second) };
  };
  return visit(root);
}

export function moveLeaf(root: SplitNode, leafId: string, direction: MoveDirection): SplitNode {
  const neighbor = findNeighbor(root, leafId, direction);
  return neighbor ? swapLeaves(root, leafId, neighbor.id) : root;
}

export const LAYOUT_PRESET_IDS = [
  "single",
  "columns-2",
  "columns-3",
  "columns-4",
  "rows-2",
  "rows-3",
  "grid-2x2",
  "main-right",
  "main-bottom",
] as const;
export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const LAYOUT_PRESET_LABELS: Record<LayoutPresetId, string> = {
  single: "Single",
  "columns-2": "Two columns",
  "columns-3": "Three columns",
  "columns-4": "Four columns",
  "rows-2": "Two rows",
  "rows-3": "Three rows",
  "grid-2x2": "Grid (2 × 2)",
  "main-right": "Main + right stack",
  "main-bottom": "Main + bottom row",
};

export function presetPaneCount(preset: LayoutPresetId): number {
  switch (preset) {
    case "single":
      return 1;
    case "columns-2":
    case "rows-2":
      return 2;
    case "columns-3":
    case "rows-3":
    case "main-right":
    case "main-bottom":
      return 3;
    case "columns-4":
    case "grid-2x2":
      return 4;
  }
}

function evenChain(direction: SplitDirection, leaves: readonly SplitLeaf[]): SplitNode {
  const [head, ...rest] = leaves;
  if (rest.length === 0) return head!;
  return {
    type: "split",
    id: createSplitId("split"),
    direction,
    ratio: 1 / leaves.length,
    first: head!,
    second: evenChain(direction, rest),
  };
}

function pair(
  direction: SplitDirection,
  first: SplitNode,
  second: SplitNode,
  ratio = 0.5,
): SplitNode {
  return { type: "split", id: createSplitId("split"), direction, ratio, first, second };
}

/**
 * Re-tiles into a preset. Existing panes keep their chat, in reading order;
 * extra slots start empty and surplus panes are dropped.
 */
export function applyPreset(root: SplitNode | null, preset: LayoutPresetId): SplitNode {
  const existing = root ? leavesInReadingOrder(root) : [];
  const count = presetPaneCount(preset);
  const leaves = Array.from({ length: count }, (_, index) => existing[index] ?? createLeaf(null));
  switch (preset) {
    case "single":
      return leaves[0]!;
    case "columns-2":
    case "columns-3":
    case "columns-4":
      return evenChain("row", leaves);
    case "rows-2":
    case "rows-3":
      return evenChain("column", leaves);
    case "grid-2x2":
      return pair(
        "column",
        pair("row", leaves[0]!, leaves[1]!),
        pair("row", leaves[2]!, leaves[3]!),
      );
    case "main-right":
      return pair("row", leaves[0]!, pair("column", leaves[1]!, leaves[2]!));
    case "main-bottom":
      return pair("column", leaves[0]!, pair("row", leaves[1]!, leaves[2]!));
  }
}

/** Which preset the tree currently matches, if any (for a checkmark in the menu). */
export function matchPreset(root: SplitNode | null): LayoutPresetId | null {
  if (!root) return "single";
  const signature = layoutSignature(root);
  for (const preset of LAYOUT_PRESET_IDS) {
    if (layoutSignature(applyPreset(null, preset)) === signature) return preset;
  }
  return null;
}

function layoutSignature(node: SplitNode): string {
  const rects = computeRects(node);
  return leavesInReadingOrder(node)
    .map((leaf) => {
      const r = rects.get(leaf.id)!;
      return [r.x, r.y, r.w, r.h].map((value) => value.toFixed(3)).join(",");
    })
    .join("|");
}

export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Snap zone for a pointer over a pane: the nearest edge splits the pane,
 * the middle replaces its chat. Edges that would make a pane too small, or
 * any edge once the pane cap is hit, fall back to the next best choice.
 */
export function resolveDropZone(
  rect: PixelRect,
  point: { x: number; y: number },
  options: { canSplit: boolean },
): DropZone {
  if (!options.canSplit || rect.width <= 0 || rect.height <= 0) return "replace";
  const fx = (point.x - rect.left) / rect.width;
  const fy = (point.y - rect.top) / rect.height;
  if (fx > 0.3 && fx < 0.7 && fy > 0.3 && fy < 0.7) return "replace";
  const canSplitHorizontally = rect.width / 2 >= MIN_PANE_WIDTH_PX;
  const canSplitVertically = rect.height / 2 >= MIN_PANE_HEIGHT_PX;
  const candidates: Array<[SplitEdge, number]> = [];
  if (canSplitHorizontally) {
    candidates.push(["left", fx], ["right", 1 - fx]);
  }
  if (canSplitVertically) {
    candidates.push(["top", fy], ["bottom", 1 - fy]);
  }
  if (candidates.length === 0) return "replace";
  candidates.sort((a, b) => a[1] - b[1]);
  return candidates[0]![0];
}

export function dropZonePreview(rect: PixelRect, zone: DropZone): PixelRect {
  switch (zone) {
    case "replace":
      return rect;
    case "left":
      return { ...rect, width: rect.width / 2 };
    case "right":
      return { ...rect, left: rect.left + rect.width / 2, width: rect.width / 2 };
    case "top":
      return { ...rect, height: rect.height / 2 };
    case "bottom":
      return { ...rect, top: rect.top + rect.height / 2, height: rect.height / 2 };
  }
}
