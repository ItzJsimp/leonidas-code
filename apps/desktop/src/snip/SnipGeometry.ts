// Pure geometry for the snip overlay. Window rectangles are physical pixels, pointer events are DIPs.

export type SnipRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
export type SnipPoint = { readonly x: number; readonly y: number };

export type SnipDisplay = {
  readonly id: number;
  readonly dipBounds: SnipRect;
  readonly physicalBounds: SnipRect;
  readonly scaleFactor: number;
};

/** A top-level window. The list is ordered from the top of the z-order down. */
export type SnipWindow = {
  readonly id: number;
  readonly title: string;
  readonly bounds: SnipRect;
};

export type SnipCropPiece = {
  readonly displayId: number;
  /** Rectangle inside that display's frozen image, in physical pixels. */
  readonly source: SnipRect;
  /** Where the piece lands inside the final image. */
  readonly destination: SnipPoint;
};

export type SnipGesture =
  | { readonly kind: "click"; readonly rect: SnipRect }
  | { readonly kind: "drag"; readonly rect: SnipRect };

export const SNIP_DRAG_THRESHOLD_PX = 4;
export const SNIP_RECENT_LIMIT = 12;
/** A maximized window reports a border this far past its display. */
const MAXIMIZED_OVERFLOW_PX = 16;

function contains(rect: SnipRect, point: SnipPoint): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}

function intersect(a: SnipRect, b: SnipRect): SnipRect | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Converts a DIP point to physical pixels. A point off every display snaps to the nearest one. */
export function dipToPhysicalPoint(
  displays: ReadonlyArray<SnipDisplay>,
  point: SnipPoint,
): SnipPoint {
  let best: { display: SnipDisplay; clamped: SnipPoint; distance: number } | undefined;
  for (const display of displays) {
    const dip = display.dipBounds;
    const clamped = {
      x: clamp(point.x, dip.x, dip.x + dip.width - 1),
      y: clamp(point.y, dip.y, dip.y + dip.height - 1),
    };
    const distance = Math.hypot(point.x - clamped.x, point.y - clamped.y);
    if (!best || distance < best.distance) best = { display, clamped, distance };
  }
  if (!best) return point;
  const { display, clamped } = best;
  return {
    x: Math.round(
      display.physicalBounds.x + (clamped.x - display.dipBounds.x) * display.scaleFactor,
    ),
    y: Math.round(
      display.physicalBounds.y + (clamped.y - display.dipBounds.y) * display.scaleFactor,
    ),
  };
}

function clipOverflow(bounds: SnipRect, display: SnipRect): SnipRect {
  let left = bounds.x;
  let top = bounds.y;
  let right = bounds.x + bounds.width;
  let bottom = bounds.y + bounds.height;
  const displayRight = display.x + display.width;
  const displayBottom = display.y + display.height;
  if (display.x - left > 0 && display.x - left <= MAXIMIZED_OVERFLOW_PX) left = display.x;
  if (display.y - top > 0 && display.y - top <= MAXIMIZED_OVERFLOW_PX) top = display.y;
  if (right - displayRight > 0 && right - displayRight <= MAXIMIZED_OVERFLOW_PX)
    right = displayRight;
  if (bottom - displayBottom > 0 && bottom - displayBottom <= MAXIMIZED_OVERFLOW_PX) {
    bottom = displayBottom;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Returns the top window under a physical point, with a maximized border trimmed to its display. */
export function hitTestWindow(
  windows: ReadonlyArray<SnipWindow>,
  displays: ReadonlyArray<SnipDisplay>,
  point: SnipPoint,
): SnipWindow | undefined {
  const hit = windows.find((window) => contains(window.bounds, point));
  if (!hit) return undefined;
  const display = displays.find((candidate) => contains(candidate.physicalBounds, point));
  return display ? { ...hit, bounds: clipOverflow(hit.bounds, display.physicalBounds) } : hit;
}

/** A small movement is a click. A larger one is a region drag, normalized to a positive size. */
export function interpretGesture(down: SnipPoint, current: SnipPoint): SnipGesture {
  const dx = current.x - down.x;
  const dy = current.y - down.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SNIP_DRAG_THRESHOLD_PX) {
    return { kind: "click", rect: { x: down.x, y: down.y, width: 0, height: 0 } };
  }
  return {
    kind: "drag",
    rect: {
      x: Math.min(down.x, current.x),
      y: Math.min(down.y, current.y),
      width: Math.abs(dx),
      height: Math.abs(dy),
    },
  };
}

/** Splits a physical rectangle into one crop per display it touches. */
export function cropPiecesForRect(
  displays: ReadonlyArray<SnipDisplay>,
  rect: SnipRect,
): ReadonlyArray<SnipCropPiece> {
  const pieces: SnipCropPiece[] = [];
  for (const display of displays) {
    const overlap = intersect(rect, display.physicalBounds);
    if (!overlap) continue;
    pieces.push({
      displayId: display.id,
      source: {
        x: overlap.x - display.physicalBounds.x,
        y: overlap.y - display.physicalBounds.y,
        width: overlap.width,
        height: overlap.height,
      },
      destination: { x: overlap.x - rect.x, y: overlap.y - rect.y },
    });
  }
  return pieces;
}

export type SnipFileEntry = { readonly name: string; readonly modifiedMs: number };

/** The newest snip files first, PNG only, capped for the Recent snips list. */
export function newestSnips<T extends SnipFileEntry>(
  files: ReadonlyArray<T>,
  limit: number = SNIP_RECENT_LIMIT,
): ReadonlyArray<T> {
  return files
    .filter((file) => /\.png$/i.test(file.name))
    .toSorted((a, b) => b.modifiedMs - a.modifiedMs)
    .slice(0, limit);
}
