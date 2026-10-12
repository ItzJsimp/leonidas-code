/**
 * Which chats are tiled side by side, and which pane has focus.
 *
 * `root === null` is the ordinary single-chat view, so the split workspace is
 * strictly opt-in and costs nothing until a second pane exists. The URL always
 * names the focused pane's chat; `syncRouteTarget` keeps the two in step when
 * the route changes from outside (sidebar click, deep link, draft promotion).
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";
import {
  MAX_PANES,
  applyPreset as applyPresetToTree,
  collectLeaves,
  countLeaves,
  createLeaf,
  findLeaf,
  findLeafByTarget,
  findNeighbor,
  moveLeaf as moveLeafInTree,
  removeLeaf,
  sameTarget,
  setLeafTarget,
  setSplitRatio,
  splitLeaf,
  type LayoutPresetId,
  type MoveDirection,
  type SplitEdge,
  type SplitNode,
} from "./splitLayout";
import type { ThreadRouteTarget } from "./threadRoutes";

const STORAGE_KEY = "leonidas:split-layout:v1";

interface SplitLayoutState {
  root: SplitNode | null;
  focusedLeafId: string | null;
  /** Follow a route change from outside the workspace. */
  syncRouteTarget: (target: ThreadRouteTarget) => void;
  focusLeaf: (leafId: string) => void;
  /**
   * Opens a new pane beside `leafId` (default: the focused pane). `base` seeds
   * the first pane when the view is still single. Returns the new pane's id.
   */
  addPane: (input: {
    base: ThreadRouteTarget;
    edge: SplitEdge;
    target: ThreadRouteTarget | null;
    leafId?: string;
  }) => string | null;
  /** Shows `target` in `leafId`; a pane already showing it is moved, not duplicated. */
  showInPane: (leafId: string, target: ThreadRouteTarget | null) => void;
  /** Closes a pane. Returns the chat the route should follow, if the focus moved. */
  closePane: (leafId: string) => { target: ThreadRouteTarget | null } | null;
  movePane: (leafId: string, direction: MoveDirection) => void;
  applyPreset: (preset: LayoutPresetId, base: ThreadRouteTarget) => void;
  resizeSplit: (splitId: string, ratio: number) => void;
  /** Back to one chat. Returns the focused chat so the route can stay on it. */
  collapse: () => ThreadRouteTarget | null;
}

function focusFallback(root: SplitNode | null, preferred: string | null): string | null {
  if (!root) return null;
  if (preferred && findLeaf(root, preferred)) return preferred;
  return collectLeaves(root)[0]?.id ?? null;
}

/** A single remaining pane is just the ordinary view again. */
function normalize(root: SplitNode | null): SplitNode | null {
  return root !== null && countLeaves(root) <= 1 ? null : root;
}

export const useSplitLayoutStore = create<SplitLayoutState>()(
  persist(
    (set, get) => ({
      root: null,
      focusedLeafId: null,
      syncRouteTarget: (target) => {
        const { root, focusedLeafId } = get();
        if (!root) return;
        const visible = findLeafByTarget(root, target);
        if (visible) {
          if (visible.id !== focusedLeafId) set({ focusedLeafId: visible.id });
          return;
        }
        const leafId = focusFallback(root, focusedLeafId);
        if (!leafId) return;
        set({ root: setLeafTarget(root, leafId, target), focusedLeafId: leafId });
      },
      focusLeaf: (leafId) => {
        const { root, focusedLeafId } = get();
        if (root && leafId !== focusedLeafId && findLeaf(root, leafId)) {
          set({ focusedLeafId: leafId });
        }
      },
      addPane: ({ base, edge, target, leafId }) => {
        const state = get();
        let root = state.root ?? createLeaf(base);
        if (countLeaves(root) >= MAX_PANES) return null;
        const anchorId = focusFallback(root, leafId ?? state.focusedLeafId);
        if (!anchorId) return null;
        let anchor = anchorId;
        if (target) {
          const existing = findLeafByTarget(root, target);
          if (existing) {
            if (existing.id === anchor) return anchor;
            const without = removeLeaf(root, existing.id);
            if (!without) return null;
            root = without;
          }
        }
        if (!findLeaf(root, anchor)) anchor = focusFallback(root, null)!;
        const pane = createLeaf(target);
        set({ root: splitLeaf(root, anchor, edge, pane), focusedLeafId: pane.id });
        return pane.id;
      },
      showInPane: (leafId, target) => {
        const { root } = get();
        if (!root || !findLeaf(root, leafId)) return;
        let next: SplitNode | null = root;
        if (target) {
          const existing = findLeafByTarget(root, target);
          if (existing && existing.id !== leafId) next = removeLeaf(root, existing.id);
        }
        if (!next) return;
        const updated = normalize(setLeafTarget(next, leafId, target));
        set({ root: updated, focusedLeafId: focusFallback(updated, leafId) });
      },
      closePane: (leafId) => {
        const { root, focusedLeafId } = get();
        if (!root || !findLeaf(root, leafId)) return null;
        // Focus passes to the pane that absorbs the freed space when possible.
        const neighbor =
          (["left", "up", "right", "down"] as const)
            .map((direction) => findNeighbor(root, leafId, direction))
            .find((candidate) => candidate !== null) ?? null;
        const remaining = removeLeaf(root, leafId);
        const nextRoot = normalize(remaining);
        const nextFocus = focusFallback(
          remaining,
          focusedLeafId === leafId ? (neighbor?.id ?? null) : focusedLeafId,
        );
        set({ root: nextRoot, focusedLeafId: nextRoot ? nextFocus : null });
        if (focusedLeafId !== leafId && nextRoot) return null;
        const focused = remaining && nextFocus ? findLeaf(remaining, nextFocus) : null;
        return { target: focused?.target ?? null };
      },
      movePane: (leafId, direction) => {
        const { root } = get();
        if (root) set({ root: moveLeafInTree(root, leafId, direction) });
      },
      applyPreset: (preset, base) => {
        const { root, focusedLeafId } = get();
        const next = normalize(applyPresetToTree(root ?? createLeaf(base), preset));
        set({ root: next, focusedLeafId: focusFallback(next, focusedLeafId) });
      },
      resizeSplit: (splitId, ratio) => {
        const { root } = get();
        if (!root) return;
        const next = setSplitRatio(root, splitId, ratio);
        if (next !== root) set({ root: next });
      },
      collapse: () => {
        const { root, focusedLeafId } = get();
        const focused = root && focusedLeafId ? findLeaf(root, focusedLeafId) : null;
        set({ root: null, focusedLeafId: null });
        return focused?.target ?? null;
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ root: state.root, focusedLeafId: state.focusedLeafId }),
    },
  ),
);

export function selectPaneCount(state: Pick<SplitLayoutState, "root">): number {
  return countLeaves(state.root);
}

export { sameTarget };
