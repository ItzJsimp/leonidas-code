import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useRef } from "react";

import {
  findLeaf,
  sameTarget,
  type LayoutPresetId,
  type MoveDirection,
  type SplitEdge,
} from "../../splitLayout";
import { useSplitLayoutStore } from "../../splitLayoutStore";
import {
  buildDraftThreadRouteParams,
  buildThreadRouteParams,
  resolveThreadRouteTarget,
  type ThreadRouteTarget,
} from "../../threadRoutes";

type Navigate = ReturnType<typeof useNavigate>;

/** The URL always names the focused pane's chat, so showing a chat means navigating to it. */
export function navigateToThreadTarget(navigate: Navigate, target: ThreadRouteTarget) {
  return target.kind === "server"
    ? navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(target.threadRef),
        replace: true,
      })
    : navigate({
        to: "/draft/$draftId",
        params: buildDraftThreadRouteParams(target.draftId),
        replace: true,
      });
}

/**
 * Every way to rearrange panes, as one set of callbacks shared by the layout
 * menu, the drag-to-snap overlay and keyboard focus changes.
 */
export function useSplitActions() {
  const navigate = useNavigate();
  const routeTarget = useParams({
    strict: false,
    select: (params) => resolveThreadRouteTarget(params),
  });
  const routeTargetRef = useRef(routeTarget);
  routeTargetRef.current = routeTarget;

  const followFocus = useCallback(
    (target: ThreadRouteTarget | null) => {
      if (target && !sameTarget(target, routeTargetRef.current)) {
        void navigateToThreadTarget(navigate, target);
      }
    },
    [navigate],
  );

  const focusPane = useCallback(
    (leafId: string) => {
      const store = useSplitLayoutStore.getState();
      if (store.focusedLeafId === leafId || !store.root) return;
      store.focusLeaf(leafId);
      followFocus(findLeaf(store.root, leafId)?.target ?? null);
    },
    [followFocus],
  );

  /** Opens a pane beside `leafId`; an empty pane waits for the user to pick a chat. */
  const splitPane = useCallback(
    (edge: SplitEdge, options?: { leafId?: string; target?: ThreadRouteTarget | null }) => {
      const base = routeTargetRef.current;
      if (!base) return null;
      const target = options?.target ?? null;
      const paneId = useSplitLayoutStore.getState().addPane({
        base,
        edge,
        target,
        ...(options?.leafId ? { leafId: options.leafId } : {}),
      });
      followFocus(target);
      return paneId;
    },
    [followFocus],
  );

  const showInPane = useCallback(
    (leafId: string, target: ThreadRouteTarget) => {
      const store = useSplitLayoutStore.getState();
      if (!store.root) {
        followFocus(target);
        return;
      }
      store.showInPane(leafId, target);
      followFocus(target);
    },
    [followFocus],
  );

  const closePane = useCallback(
    (leafId: string) => {
      const result = useSplitLayoutStore.getState().closePane(leafId);
      if (result) followFocus(result.target);
    },
    [followFocus],
  );

  const collapse = useCallback(() => {
    followFocus(useSplitLayoutStore.getState().collapse());
  }, [followFocus]);

  const movePane = useCallback((leafId: string, direction: MoveDirection) => {
    useSplitLayoutStore.getState().movePane(leafId, direction);
  }, []);

  const applyPreset = useCallback(
    (preset: LayoutPresetId) => {
      if (preset === "single") {
        followFocus(useSplitLayoutStore.getState().collapse());
        return;
      }
      const base = routeTargetRef.current;
      if (base) useSplitLayoutStore.getState().applyPreset(preset, base);
      // A preset can drop the focused pane's chat; keep the URL on a visible chat.
      const { root, focusedLeafId } = useSplitLayoutStore.getState();
      const focused = root && focusedLeafId ? findLeaf(root, focusedLeafId) : null;
      followFocus(focused?.target ?? null);
    },
    [followFocus],
  );

  return {
    routeTarget,
    followFocus,
    focusPane,
    splitPane,
    showInPane,
    closePane,
    collapse,
    movePane,
    applyPreset,
  };
}
