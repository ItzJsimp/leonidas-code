import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ScopedThreadRef } from "@t3tools/contracts";

import { observeResize } from "~/lib/observeResize";
import { selectPaneCount, useSplitLayoutStore } from "~/splitLayoutStore";

import { CommandCenterForward } from "./CommandCenterForward";
import { LeftRail } from "./LeftRail";
import { RailDrawer } from "./RailDrawer";
import { railsMode, splitFits } from "./railsMode";
import { RightRail } from "./RightRail";
import { HomeCardsOutlet } from "./SlotOutlet";
import { HEADER_HEIGHT, TwoStateHeader } from "./TwoStateHeader";
import { useTwoStateStore } from "./twoStateStore";
import { CodeForwardContext } from "./codeForwardContext";
import { useLiveArea } from "./useLiveArea";

export const LEFT_RAIL_WIDTH = 272;
export const RIGHT_RAIL_WIDTH = 304;
/** The chat keeps at least this much width before the rails move into the drawer. */
const MIN_CHAT_WIDTH = 560;
export const RAILS_MIN_WIDTH = LEFT_RAIL_WIDTH + RIGHT_RAIL_WIDTH + MIN_CHAT_WIDTH;

/**
 * State 2: the chat in the center and the Command Center in the side rails. A resize observer,
 * not a container query: a query container would anchor the header's fixed controls to it.
 */
export function CodeForward({
  place,
  children,
}: {
  /** The open chat, so the swap key can return to it. Null for a draft. */
  readonly place: ScopedThreadRef | null;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  const splitActive = useSplitLayoutStore((state) => selectPaneCount(state) > 1);
  const [roomy, setRoomy] = useState(false);
  const split = useTwoStateStore((state) => state.split) && !splitActive && roomy;
  const rememberThread = useTwoStateStore((state) => state.rememberThread);

  useEffect(() => {
    if (place) rememberThread(place);
  }, [place, rememberThread]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    return observeResize(element, ([entry]) => {
      if (!entry) return;
      setFits(entry.contentRect.width >= RAILS_MIN_WIDTH);
      setRoomy(splitFits(entry.contentRect.width));
    });
  }, []);

  const mode = railsMode({ fits, split, splitActive });
  const rails = mode === "rails";
  const live = useLiveArea(place);
  const value = useMemo(() => ({ rails, live }), [rails, live]);
  // The chat header's fixed controls sit below the band and, with rails, end at the right rail.
  const style = {
    "--workspace-controls-top": `calc(env(titlebar-area-y, 0px) + ${HEADER_HEIGHT})`,
    ...(rails ? { "--workspace-controls-right": `calc(${RIGHT_RAIL_WIDTH}px + 0.75rem)` } : {}),
  } as CSSProperties;
  return (
    <CodeForwardContext value={value}>
      <div style={style} className="flex h-svh min-h-0 min-w-0 flex-1 flex-col md:h-dvh">
        <TwoStateHeader leading={mode === "drawer" ? <RailDrawer /> : undefined} />
        {/* The thread view sizes itself to the window; here it fills the row under the band. */}
        <div ref={ref} className="flex min-h-0 min-w-0 flex-1 [&>main]:h-full">
          {split ? <CommandCenterPane /> : null}
          {rails ? (
            <Rail side="left" label="Your AIOS">
              <LeftRail />
            </Rail>
          ) : null}
          {children}
          {rails ? (
            <Rail side="right" label="Needs you and activity">
              <RightRail />
            </Rail>
          ) : null}
        </div>
      </div>
    </CodeForwardContext>
  );
}

function Rail({
  side,
  label,
  children,
}: {
  readonly side: "left" | "right";
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      style={{ width: side === "left" ? LEFT_RAIL_WIDTH : RIGHT_RAIL_WIDTH }}
      className={
        side === "left"
          ? "flex shrink-0 flex-col border-r border-border/60 bg-background"
          : "flex shrink-0 flex-col border-l border-border/60 bg-background"
      }
    >
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}

const CC_CONTEXT = { forward: "cc" } as const;

/** The left half of the 50/50 split: the Command Center as it looks when forward. */
function CommandCenterPane() {
  return (
    <section
      aria-label="Command Center"
      className="min-h-0 basis-1/2 overflow-y-auto border-r border-border/60"
    >
      <div className="grid gap-6 p-6">
        <CommandCenterForward />
        <HomeCardsOutlet context={CC_CONTEXT} />
      </div>
    </section>
  );
}
