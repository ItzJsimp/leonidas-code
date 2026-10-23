import { useCallback, useState } from "react";

const KEY = "leonidas.tasks.railWidth";
const RAIL_MIN = 208;
const RAIL_MAX = 480;
const RAIL_DEFAULT = 288;

const clamp = (value: number) => Math.min(RAIL_MAX, Math.max(RAIL_MIN, value));

function readWidth() {
  try {
    const saved = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(saved) && saved > 0 ? clamp(saved) : RAIL_DEFAULT;
  } catch {
    return RAIL_DEFAULT;
  }
}

/** Width of the tasks project rail, persisted; `handle` is the drag grip for its right edge. */
export function useRailWidth() {
  const [width, setWidth] = useState(readWidth);
  const commit = useCallback((next: number) => {
    const value = clamp(next);
    setWidth(value);
    try {
      window.localStorage.setItem(KEY, String(value));
    } catch {
      // Width just will not persist.
    }
  }, []);

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize project list"
      aria-valuemin={RAIL_MIN}
      aria-valuemax={RAIL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      className="hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40 focus-visible:bg-primary/60 @4xl/tasks:block"
      onPointerDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        const move = (e: PointerEvent) => setWidth(clamp(startWidth + e.clientX - startX));
        const up = (e: PointerEvent) => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          commit(startWidth + e.clientX - startX);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") commit(width - 16);
        if (event.key === "ArrowRight") commit(width + 16);
      }}
      onDoubleClick={() => commit(RAIL_DEFAULT)}
    />
  );
  return { width, handle };
}
