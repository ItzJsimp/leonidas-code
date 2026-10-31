export const LONG_PRESS_MS = 450;
const SLOP_PX = 8;
const SWIPE_START_PX = 12;
// How much more horizontal than vertical a move must be to count as a swipe.
const HORIZONTAL_BIAS = 1.5;
const COMMIT_RATIO = 0.4;
const FLICK_MIN_PX = 48;
const FLICK_PX_PER_MS = 0.5;

export interface RowTouchHandlers {
  onLongPress: (point: { x: number; y: number }) => void;
  /** Distance the row follows the finger: zero or negative, never to the right. */
  onSwipeMove: (dx: number) => void;
  onSwipeEnd: (committed: boolean) => void;
}

type Phase = "pending" | "swiping" | "menu" | "scroll" | "done";

/**
 * One touch on a chat row: a still hold opens the row menu, a leftward drag
 * swipes the row, anything else is left to the browser (scroll) or the click.
 * Pure state and timers, so the pointer events and the DOM stay in Sidebar.tsx.
 */
export class RowTouchGesture {
  private phase: Phase = "done";
  private startX = 0;
  private startY = 0;
  private startedAt = 0;
  private lastDx = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private suppressClick = false;

  constructor(
    private readonly handlers: RowTouchHandlers,
    private readonly options: { canSwipe: () => boolean; width: () => number },
  ) {}

  down(x: number, y: number) {
    this.clearTimer();
    this.phase = "pending";
    this.startX = x;
    this.startY = y;
    this.startedAt = Date.now();
    this.lastDx = 0;
    this.suppressClick = false;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.phase !== "pending") return;
      this.phase = "menu";
      this.suppressClick = true;
      this.handlers.onLongPress({ x: this.startX, y: this.startY });
    }, LONG_PRESS_MS);
  }

  move(x: number, y: number) {
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (this.phase === "pending") {
      if (Math.hypot(dx, dy) <= SLOP_PX) return;
      this.clearTimer();
      const swipes =
        dx < -SWIPE_START_PX &&
        Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS &&
        this.options.canSwipe();
      this.phase = swipes ? "swiping" : "scroll";
    }
    if (this.phase !== "swiping") return;
    this.lastDx = Math.min(0, dx);
    this.handlers.onSwipeMove(this.lastDx);
  }

  up() {
    this.clearTimer();
    if (this.phase === "swiping") {
      const elapsed = Math.max(Date.now() - this.startedAt, 1);
      const distance = -this.lastDx;
      const committed =
        distance >= this.options.width() * COMMIT_RATIO ||
        (distance >= FLICK_MIN_PX && distance / elapsed >= FLICK_PX_PER_MS);
      this.suppressClick = true;
      this.handlers.onSwipeEnd(committed);
    }
    this.phase = "done";
  }

  cancel() {
    this.clearTimer();
    if (this.phase === "swiping") this.handlers.onSwipeEnd(false);
    this.phase = "done";
  }

  /** True once after a long press or swipe, so the release click does not open the chat. */
  takeClickSuppression() {
    const suppress = this.suppressClick;
    this.suppressClick = false;
    return suppress;
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
