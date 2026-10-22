import {
  type CSSProperties,
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { observeResize } from "~/lib/observeResize";
import { selectPaneCount, useSplitLayoutStore } from "~/splitLayoutStore";

import { LeftRail } from "./LeftRail";

export const LEFT_RAIL_WIDTH = 272;
export const RIGHT_RAIL_WIDTH = 304;
/** The chat keeps at least this much width before the rails move into the drawer. */
const MIN_CHAT_WIDTH = 560;
export const RAILS_MIN_WIDTH = LEFT_RAIL_WIDTH + RIGHT_RAIL_WIDTH + MIN_CHAT_WIDTH;

const CodeForwardContext = createContext({ rails: false });

/** Whether the Command Center rails show beside this chat. False outside State 2. */
export const useCodeForward = () => use(CodeForwardContext);

/**
 * State 2: the chat in the center and the Command Center in the side rails. A resize observer,
 * not a container query: a query container would anchor the header's fixed controls to it.
 */
export function CodeForward({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  const splitActive = useSplitLayoutStore((state) => selectPaneCount(state) > 1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    return observeResize(element, ([entry]) => {
      if (entry) setFits(entry.contentRect.width >= RAILS_MIN_WIDTH);
    });
  }, []);

  const rails = fits && !splitActive;
  const value = useMemo(() => ({ rails }), [rails]);
  const style = undefined;
  return (
    <CodeForwardContext value={value}>
      <div ref={ref} style={style} className="flex h-svh min-h-0 min-w-0 flex-1 md:h-dvh">
        {rails ? (
          <Rail side="left" label="Your AIOS">
            <LeftRail />
          </Rail>
        ) : null}
        {children}
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
      {/* Lines up with the chat header row. On desktop it also moves the window. */}
      <div
        aria-hidden
        className="h-[var(--workspace-topbar-height)] shrink-0 [-webkit-app-region:drag]"
      />
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-3 pb-3">
        {children}
      </div>
    </aside>
  );
}
