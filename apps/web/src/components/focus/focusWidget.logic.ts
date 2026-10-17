import type { FocusItem, FocusSection, FocusSnapshot, ProjectId } from "@t3tools/contracts";

export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface Size {
  readonly width: number;
  readonly height: number;
}

export type FocusScope = "project" | "all";

/** Space kept between a floating widget and the window edge. */
const FOCUS_EDGE_GAP = 8;
/** A floating widget dropped this close to its dock goes back to the dock. */
const FOCUS_SNAP_DISTANCE = 24;

/** Keeps the whole widget inside the viewport; a widget larger than the viewport sticks to the top left. */
export function clampToViewport(position: Point, widget: Size, viewport: Size): Point {
  const maxX = Math.max(FOCUS_EDGE_GAP, viewport.width - widget.width - FOCUS_EDGE_GAP);
  const maxY = Math.max(FOCUS_EDGE_GAP, viewport.height - widget.height - FOCUS_EDGE_GAP);
  return {
    x: Math.round(Math.min(Math.max(position.x, FOCUS_EDGE_GAP), maxX)),
    y: Math.round(Math.min(Math.max(position.y, FOCUS_EDGE_GAP), maxY)),
  };
}

/** Where the widget ends after a drag: `null` means docked. */
export function settleDrag(
  position: Point,
  dock: Point | null,
  widget: Size,
  viewport: Size,
): Point | null {
  const clamped = clampToViewport(position, widget, viewport);
  if (dock && Math.hypot(clamped.x - dock.x, clamped.y - dock.y) <= FOCUS_SNAP_DISTANCE) {
    return null;
  }
  return clamped;
}

/** Arrow keys move a floating widget; Shift moves it faster. */
export function nudge(position: Point, key: string, shift: boolean): Point | null {
  const step = shift ? 40 : 10;
  switch (key) {
    case "ArrowLeft":
      return { x: position.x - step, y: position.y };
    case "ArrowRight":
      return { x: position.x + step, y: position.y };
    case "ArrowUp":
      return { x: position.x, y: position.y - step };
    case "ArrowDown":
      return { x: position.x, y: position.y + step };
    default:
      return null;
  }
}

export interface FocusRow extends FocusItem {
  /** Section slug, `null` for Global. Used when the line becomes a task card. */
  readonly slug: string | null;
}

/** Project scope shows the project's section plus Global; All shows every section. */
export function visibleRows(
  snapshot: FocusSnapshot | null,
  scope: FocusScope,
  projectId: ProjectId | null,
): FocusRow[] {
  if (!snapshot) return [];
  const wanted = (section: FocusSection) =>
    scope === "all" ||
    section.slug === null ||
    (projectId !== null && section.projectId === projectId);
  return snapshot.sections
    .filter(wanted)
    .flatMap((section) => section.items.map((item) => ({ ...item, slug: section.slug })));
}

export function progressOf(rows: ReadonlyArray<FocusRow>): { done: number; total: number } {
  return { done: rows.filter((row) => row.done).length, total: rows.length };
}
