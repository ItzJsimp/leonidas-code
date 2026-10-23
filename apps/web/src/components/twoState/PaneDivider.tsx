import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

import { cn } from "~/lib/utils";

import { clampRatio, keyRatio } from "./shellLayout";

/** The draggable edge between the two panes: an 8 px hit area around a 1 px line. */
export const DIVIDER_PX = 8;

export function PaneDivider({
  ratio,
  containerRef,
  onChange,
}: {
  /** The left pane's share, 0 to 1. */
  readonly ratio: number;
  /** The row both panes sit in, so a drag can turn the pointer position into a share. */
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly onChange: (ratio: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const width = () => containerRef.current?.getBoundingClientRect().width ?? 0;

  const dragTo = (clientX: number) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= DIVIDER_PX) return;
    const usable = bounds.width - DIVIDER_PX;
    onChange(clampRatio((clientX - bounds.left - DIVIDER_PX / 2) / usable, bounds.width));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) dragTo(event.clientX);
  };
  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyRatio(event.key, ratio, width());
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      data-dragging={dragging ? "true" : "false"}
      style={{ width: DIVIDER_PX }}
      className="group relative shrink-0 cursor-col-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [-webkit-app-region:no-drag]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onDoubleClick={() => onChange(0.5)}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors motion-reduce:transition-none group-hover:bg-primary group-data-[dragging=true]:bg-primary",
        )}
      />
    </div>
  );
}
