import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  MAX_PANES,
  collectLeaves,
  dropZonePreview,
  resolveDropZone,
  type DropZone,
  type PixelRect,
} from "../../splitLayout";
import { useSplitLayoutStore } from "../../splitLayoutStore";
import type { ThreadRouteTarget } from "../../threadRoutes";
import { setThreadDropHandler, subscribeThreadDrag } from "../chat/threadContextDrag";
import { useSplitActions } from "./useSplitActions";

/** Marks the pane of the ordinary single-chat view so it can take drops too. */
export const SINGLE_PANE_ID = "single";

const ZONE_LABELS: Record<DropZone, string> = {
  left: "Split left",
  right: "Split right",
  top: "Split up",
  bottom: "Split down",
  replace: "Open here",
};

interface Hit {
  readonly leafId: string;
  readonly zone: DropZone;
  readonly preview: PixelRect;
}

function hitTest(point: { x: number; y: number }, canSplit: boolean): Hit | null {
  for (const element of document.querySelectorAll<HTMLElement>("[data-split-leaf]")) {
    const bounds = element.getBoundingClientRect();
    if (
      point.x < bounds.left ||
      point.x > bounds.right ||
      point.y < bounds.top ||
      point.y > bounds.bottom
    ) {
      continue;
    }
    const rect: PixelRect = {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    const zone = resolveDropZone(rect, point, { canSplit });
    return {
      leafId: element.dataset.splitLeaf ?? SINGLE_PANE_ID,
      zone,
      preview: dropZonePreview(rect, zone),
    };
  }
  return null;
}

/**
 * Drag a chat from the sidebar over the workspace and it snaps: a solid tint
 * shows the half of a pane the chat will take (or the whole pane to replace
 * it). Dropping on a composer still attaches the chat as context instead.
 */
export const SplitDropOverlay = memo(function SplitDropOverlay() {
  const [hit, setHit] = useState<Hit | null>(null);
  const actions = useSplitActions();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const canSplit = () => {
      const root = useSplitLayoutStore.getState().root;
      return (root ? collectLeaves(root).length : 1) < MAX_PANES;
    };
    const unsubscribe = subscribeThreadDrag((point) => {
      if (!point || point.overComposer) {
        setHit((current) => (current === null ? current : null));
        return;
      }
      const next = hitTest(point, canSplit());
      setHit((current) =>
        current?.leafId === next?.leafId && current?.zone === next?.zone ? current : next,
      );
    });
    const removeHandler = setThreadDropHandler((point, threads) => {
      const thread = threads[0];
      const landed = hitTest(point, canSplit());
      if (!thread || !landed) return false;
      const target: ThreadRouteTarget = { kind: "server", threadRef: thread };
      const { splitPane, showInPane } = actionsRef.current;
      const single = landed.leafId === SINGLE_PANE_ID;
      if (landed.zone === "replace") {
        showInPane(single ? SINGLE_PANE_ID : landed.leafId, target);
      } else {
        splitPane(landed.zone, {
          ...(single ? {} : { leafId: landed.leafId }),
          target,
        });
      }
      return true;
    });
    return () => {
      unsubscribe();
      removeHandler();
    };
  }, []);

  if (!hit) return null;
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[90] flex items-center justify-center rounded-lg border-2 border-primary/70 bg-primary/20 transition-[transform,width,height] duration-150 ease-out motion-reduce:transition-none"
      style={{
        transform: `translate(${hit.preview.left}px, ${hit.preview.top}px)`,
        width: hit.preview.width,
        height: hit.preview.height,
      }}
    >
      <span className="rounded-full bg-popover px-3 py-1 text-xs font-medium text-foreground shadow-md">
        {ZONE_LABELS[hit.zone]}
      </span>
    </div>,
    document.body,
  );
});
