// Pointer state machine for one snip. All points and rectangles are physical pixels.
import {
  hitTestWindow,
  interpretGesture,
  type SnipDisplay,
  type SnipPoint,
  type SnipRect,
  type SnipWindow,
} from "./SnipGeometry.ts";

export type SnipView = {
  /** Window under the pointer, shown before the user presses. */
  readonly highlight?: SnipRect;
  readonly label?: string;
  /** Region being dragged. */
  readonly selection?: SnipRect;
};

export type SnipOutcome =
  | { readonly kind: "selected"; readonly rect: SnipRect }
  | { readonly kind: "cancelled" };

export interface SnipSession {
  readonly move: (point: SnipPoint) => SnipView;
  readonly down: (point: SnipPoint) => void;
  /** Returns an outcome when the click or drag finishes the snip. */
  readonly up: (point: SnipPoint) => SnipOutcome | undefined;
  readonly cancel: () => SnipOutcome;
}

function unionBounds(displays: ReadonlyArray<SnipDisplay>): SnipRect {
  const left = Math.min(...displays.map((display) => display.physicalBounds.x));
  const top = Math.min(...displays.map((display) => display.physicalBounds.y));
  const right = Math.max(
    ...displays.map((display) => display.physicalBounds.x + display.physicalBounds.width),
  );
  const bottom = Math.max(
    ...displays.map((display) => display.physicalBounds.y + display.physicalBounds.height),
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function clampRect(rect: SnipRect, bounds: SnipRect): SnipRect | undefined {
  const left = Math.max(rect.x, bounds.x);
  const top = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : undefined;
}

export function createSnipSession(input: {
  readonly displays: ReadonlyArray<SnipDisplay>;
  readonly windows: ReadonlyArray<SnipWindow>;
}): SnipSession {
  const { displays, windows } = input;
  const bounds = displays.length > 0 ? unionBounds(displays) : undefined;
  let pressedAt: SnipPoint | undefined;
  let finished = false;

  const dragSelection = (point: SnipPoint): SnipRect | undefined => {
    if (!pressedAt || !bounds) return undefined;
    const gesture = interpretGesture(pressedAt, point);
    return gesture.kind === "drag" ? clampRect(gesture.rect, bounds) : undefined;
  };

  return {
    move: (point) => {
      if (finished) return {};
      const selection = dragSelection(point);
      if (selection) return { selection };
      if (pressedAt) return {};
      const hit = hitTestWindow(windows, displays, point);
      return hit ? { highlight: hit.bounds, label: hit.title } : {};
    },
    down: (point) => {
      if (!finished) pressedAt = point;
    },
    up: (point) => {
      if (finished || !pressedAt) return undefined;
      const gesture = interpretGesture(pressedAt, point);
      const selection = dragSelection(point);
      pressedAt = undefined;
      if (gesture.kind === "drag") {
        if (!selection) return undefined;
        finished = true;
        return { kind: "selected", rect: selection };
      }
      const hit = hitTestWindow(windows, displays, point);
      if (!hit) return undefined;
      finished = true;
      return { kind: "selected", rect: hit.bounds };
    },
    cancel: () => {
      finished = true;
      pressedAt = undefined;
      return { kind: "cancelled" };
    },
  };
}
