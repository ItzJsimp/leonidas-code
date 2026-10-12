import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { MessagesSquareIcon, PlusIcon, XIcon } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { startNewThreadFromContext } from "../../lib/chatThreadActions";
import {
  finalizePromotedDraftThreadByRef,
  markPromotedDraftThreadByRef,
  useComposerDraftStore,
} from "../../composerDraftStore";
import {
  clampRatio,
  collectLeaves,
  computeDividers,
  computeRects,
  sameTarget,
  type Rect,
  type SplitDivider,
} from "../../splitLayout";
import { useSplitLayoutStore } from "../../splitLayoutStore";
import { useThreadShell, useThreadShells } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { environmentShell } from "../../state/shell";
import { resolveThreadRouteRenderState, type ThreadRouteTarget } from "../../threadRoutes";
import { cn } from "~/lib/utils";
import ChatView from "../ChatView";
import { threadHasStarted } from "../ChatView.logic";
import { Button } from "../ui/button";
import { SplitPaneContext, type SplitPaneInfo } from "./splitPaneContext";
import { useSplitActions } from "./useSplitActions";

const DIVIDER_HIT_PX = 9;
const KEYBOARD_STEP = 0.02;

function routeTargetKey(target: ThreadRouteTarget): string {
  return target.kind === "server" ? scopedThreadKey(target.threadRef) : `draft:${target.draftId}`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

/**
 * Tiles several chats in one window. Panes render as one flat keyed list
 * positioned by percentages, so moving, resizing or re-tiling only touches
 * styles: a running chat is never remounted by a layout change.
 */
export function SplitWorkspace({ routeTarget }: { routeTarget: ThreadRouteTarget }) {
  const root = useSplitLayoutStore((state) => state.root);
  const focusedLeafId = useSplitLayoutStore((state) => state.focusedLeafId);
  const syncRouteTarget = useSplitLayoutStore((state) => state.syncRouteTarget);
  const routeKey = routeTargetKey(routeTarget);
  const containerRef = useRef<HTMLDivElement>(null);
  const actions = useSplitActions();

  // Before paint, so a sidebar click never flashes the previous chat in the focused pane.
  useLayoutEffect(() => {
    syncRouteTarget(routeTarget);
  }, [routeKey, syncRouteTarget]);

  const layout = useMemo(
    () =>
      root
        ? {
            leaves: collectLeaves(root),
            rects: computeRects(root),
            dividers: computeDividers(root),
          }
        : null,
    [root],
  );
  if (!layout) return null;

  return (
    <div ref={containerRef} className="relative h-full min-h-0 w-full min-w-0 overflow-hidden">
      {layout.leaves.map((leaf) => (
        <SplitPane
          key={leaf.id}
          leafId={leaf.id}
          target={leaf.target}
          rect={layout.rects.get(leaf.id)!}
          focused={leaf.id === focusedLeafId}
          onFocusPane={actions.focusPane}
        />
      ))}
      {layout.dividers.map((divider) => (
        <SplitDividerHandle key={divider.splitId} divider={divider} containerRef={containerRef} />
      ))}
    </div>
  );
}

const SplitPane = memo(function SplitPane({
  leafId,
  target,
  rect,
  focused,
  onFocusPane,
}: {
  leafId: string;
  target: ThreadRouteTarget | null;
  rect: Rect;
  focused: boolean;
  onFocusPane: (leafId: string) => void;
}) {
  const atTop = rect.y < 1e-6;
  const atLeft = rect.x < 1e-6;
  const atRight = rect.x + rect.w > 1 - 1e-6;
  const info = useMemo<SplitPaneInfo>(() => ({ leafId, active: focused }), [leafId, focused]);
  // Header controls and native window buttons anchor to the viewport edge; only
  // the pane that actually touches that edge keeps the room reserved for them.
  const style = {
    left: percent(rect.x),
    top: percent(rect.y),
    width: percent(rect.w),
    height: percent(rect.h),
    // Makes the pane the containing block for the header's fixed-position controls.
    contain: "layout",
    ...(atRight
      ? {}
      : {
          "--workspace-controls-right": "0.75rem",
          "--workspace-native-controls-inset": "0.75rem",
        }),
    ...(atLeft ? {} : { "--workspace-titlebar-content-left": "var(--workspace-gutter-start)" }),
  } as CSSProperties;

  return (
    <div
      data-split-leaf={leafId}
      data-split-focused={focused ? "true" : "false"}
      className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
      style={style}
      onPointerDownCapture={() => onFocusPane(leafId)}
      onFocusCapture={() => onFocusPane(leafId)}
    >
      <SplitPaneContext value={info}>
        {target === null ? (
          <EmptyPane leafId={leafId} />
        ) : (
          <ThreadPane
            leafId={leafId}
            target={target}
            routePane={focused}
            reserveTitleBarControlInset={atTop && atRight}
          />
        )}
      </SplitPaneContext>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-[60] h-0.5 transition-opacity duration-150",
          focused ? "bg-primary/70 opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
});

/** One chat in a pane. Mirrors how the single view hosts a chat, minus route redirects. */
const ThreadPane = memo(function ThreadPane({
  leafId,
  target,
  routePane,
  reserveTitleBarControlInset,
}: {
  leafId: string;
  target: ThreadRouteTarget;
  routePane: boolean;
  reserveTitleBarControlInset: boolean;
}) {
  const actions = useSplitActions();
  const draftId = target.kind === "draft" ? target.draftId : null;
  const draftSession = useComposerDraftStore((store) =>
    draftId === null ? null : store.getDraftSession(draftId),
  );
  const serverThreadRef = target.kind === "server" ? target.threadRef : null;
  const promotedTo = draftSession?.promotedTo ?? null;
  const serverThread = useThreadShell(serverThreadRef);
  const shell = useEnvironmentQuery(
    serverThreadRef === null ? null : environmentShell.stateAtom(serverThreadRef.environmentId),
  );
  const bootstrapComplete = shell.data?.snapshot._tag === "Some";
  const draftThread = useComposerDraftStore((store) =>
    serverThreadRef ? store.getDraftThreadByRef(serverThreadRef) : null,
  );
  const promotedDraftId = useComposerDraftStore((store) =>
    serverThreadRef ? store.getDraftIdByRef(serverThreadRef) : null,
  );

  // A background send promotes its draft to a server thread; keep the pane on it.
  useEffect(() => {
    if (promotedTo) {
      useSplitLayoutStore.getState().showInPane(leafId, { kind: "server", threadRef: promotedTo });
    }
  }, [leafId, promotedTo]);
  // The focused pane is finished off by the route view; other panes do it themselves.
  useEffect(() => {
    if (routePane || !serverThreadRef) return;
    if (draftThread) {
      if (threadHasStarted(serverThread)) finalizePromotedDraftThreadByRef(serverThreadRef);
      else markPromotedDraftThreadByRef(serverThreadRef);
    }
  }, [draftThread, routePane, serverThread, serverThreadRef]);

  // Latch the draft's key so the chat that carried the draft keeps its identity
  // after the draft record disappears (same rule as the single view).
  const [latched, setLatched] = useState<{ threadKey: string; key: string } | null>(null);
  const threadKey = serverThreadRef ? scopedThreadKey(serverThreadRef) : null;
  const nextLatched =
    threadKey === null
      ? null
      : latched?.threadKey === threadKey
        ? latched
        : promotedDraftId
          ? { threadKey, key: promotedDraftId }
          : null;
  if (nextLatched !== latched) setLatched(nextLatched);

  const renderState = resolveThreadRouteRenderState({
    bootstrapComplete,
    serverThreadExists: serverThread !== null,
    serverThreadDeleted: serverThread?.deletedAt != null,
    draftThreadExists: draftThread !== null,
  });

  if (target.kind === "draft") {
    if (!draftSession) {
      return <UnavailablePane onClose={() => actions.closePane(leafId)} />;
    }
    return (
      <ChatView
        key={target.draftId}
        draftId={target.draftId}
        environmentId={draftSession.environmentId}
        threadId={draftSession.threadId}
        routeKind="draft"
        reserveTitleBarControlInset={reserveTitleBarControlInset}
        forceExpandedMobileComposer
      />
    );
  }
  if (renderState === "missing") {
    return <UnavailablePane onClose={() => actions.closePane(leafId)} />;
  }
  if (renderState === "loading" && serverThread === null) return null;
  return (
    <ChatView
      key={nextLatched?.key}
      environmentId={target.threadRef.environmentId}
      threadId={target.threadRef.threadId}
      routeKind="server"
      reserveTitleBarControlInset={reserveTitleBarControlInset}
    />
  );
});

function UnavailablePane({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">This chat is no longer available.</p>
      <Button size="compact" variant="outline" onClick={onClose}>
        <XIcon /> Close pane
      </Button>
    </div>
  );
}

const RECENT_CHAT_LIMIT = 6;

/** A new pane before it has a chat: pick a recent one or start fresh. */
const EmptyPane = memo(function EmptyPane({ leafId }: { leafId: string }) {
  const actions = useSplitActions();
  const shells = useThreadShells();
  const root = useSplitLayoutStore((state) => state.root);
  const newThread = useHandleNewThread();
  const recent = useMemo(() => {
    const shown = root
      ? collectLeaves(root).flatMap((leaf) => (leaf.target ? [leaf.target] : []))
      : [];
    return shells
      .filter(
        (thread) =>
          thread.archivedAt === null &&
          thread.deletedAt == null &&
          !shown.some((target) =>
            sameTarget(target, {
              kind: "server",
              threadRef: scopeThreadRef(thread.environmentId, thread.id),
            }),
          ),
      )
      .toSorted((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, RECENT_CHAT_LIMIT);
  }, [root, shells]);

  const startNewChat = useCallback(() => {
    actions.focusPane(leafId);
    void startNewThreadFromContext({
      activeDraftThread: newThread.activeDraftThread,
      activeThread: newThread.activeThread ?? undefined,
      defaultProjectRef: newThread.defaultProjectRef,
      handleNewThread: newThread.handleNewThread,
    });
  }, [actions, leafId, newThread]);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto p-6 scrollbar-gutter-both">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <p className="text-sm font-medium text-foreground">Choose a chat for this pane</p>
        <Button size="compact" variant="outline" onClick={startNewChat}>
          <PlusIcon /> New chat
        </Button>
        {recent.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {recent.map((thread) => (
              <li key={`${thread.environmentId}:${thread.id}`}>
                <button
                  type="button"
                  className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() =>
                    actions.showInPane(leafId, {
                      kind: "server",
                      threadRef: scopeThreadRef(thread.environmentId, thread.id),
                    })
                  }
                >
                  <MessagesSquareIcon className="size-4 shrink-0 text-secondary-label" />
                  <span className="min-w-0 truncate">{thread.title || "Untitled chat"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button size="compact" variant="ghost" onClick={() => actions.closePane(leafId)}>
          Close pane
        </Button>
      </div>
    </div>
  );
});

function SplitDividerHandle({
  divider,
  containerRef,
}: {
  divider: SplitDivider;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<number | null>(null);
  const horizontal = divider.direction === "row";
  const position = horizontal
    ? divider.region.x + divider.region.w * divider.ratio
    : divider.region.y + divider.region.h * divider.ratio;

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const resizeTo = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;
      const ratio = horizontal
        ? ((clientX - bounds.left) / bounds.width - divider.region.x) / divider.region.w
        : ((clientY - bounds.top) / bounds.height - divider.region.y) / divider.region.h;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        useSplitLayoutStore.getState().resizeSplit(divider.splitId, ratio);
      });
    },
    [containerRef, divider.region, divider.splitId, horizontal],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) resizeTo(event.clientX, event.clientY);
  };
  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const forward = horizontal ? "ArrowRight" : "ArrowDown";
    const backward = horizontal ? "ArrowLeft" : "ArrowUp";
    if (event.key !== forward && event.key !== backward) return;
    event.preventDefault();
    const delta = event.key === forward ? KEYBOARD_STEP : -KEYBOARD_STEP;
    useSplitLayoutStore.getState().resizeSplit(divider.splitId, clampRatio(divider.ratio + delta));
  };

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-label="Resize panes"
      aria-valuenow={Math.round(divider.ratio * 100)}
      tabIndex={0}
      data-dragging={dragging ? "true" : "false"}
      className={cn(
        "group absolute z-[70] touch-none outline-none [-webkit-app-region:no-drag]",
        horizontal ? "cursor-col-resize" : "cursor-row-resize",
      )}
      style={
        horizontal
          ? {
              left: `calc(${percent(position)} - ${DIVIDER_HIT_PX / 2}px)`,
              top: percent(divider.region.y),
              height: percent(divider.region.h),
              width: DIVIDER_HIT_PX,
            }
          : {
              top: `calc(${percent(position)} - ${DIVIDER_HIT_PX / 2}px)`,
              left: percent(divider.region.x),
              width: percent(divider.region.w),
              height: DIVIDER_HIT_PX,
            }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onDoubleClick={() => useSplitLayoutStore.getState().resizeSplit(divider.splitId, 0.5)}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden
        className={cn(
          "absolute bg-border transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary/60 group-data-[dragging=true]:bg-primary",
          horizontal
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:w-0.5 group-data-[dragging=true]:w-0.5"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2 group-hover:h-0.5 group-data-[dragging=true]:h-0.5",
        )}
      />
    </div>
  );
}
