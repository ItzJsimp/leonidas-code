import { useSyncExternalStore } from "react";

export type LimitView = "used" | "left";

const KEY = "leonidas.usageLimitView";
const listeners = new Set<() => void>();

/** Claude Code reports % used, so that is the default; the choice is remembered per browser. */
function read(): LimitView {
  try {
    return localStorage.getItem(KEY) === "left" ? "left" : "used";
  } catch {
    return "used";
  }
}

let current = read();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setLimitView(next: LimitView) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode: the choice just lasts until reload.
  }
  for (const listener of listeners) listener();
}

/** One used/left choice shared by every usage surface, so they never disagree on screen. */
export function useLimitView(): readonly [LimitView, () => void] {
  const view = useSyncExternalStore(
    subscribe,
    () => current,
    () => "used" as const,
  );
  return [view, () => setLimitView(view === "used" ? "left" : "used")] as const;
}

/** `62% used` or `38% left` for a window's used percent. */
export function limitText(usedPercent: number, view: LimitView): string {
  const used = Math.round(Math.max(0, Math.min(100, usedPercent)));
  return view === "used" ? `${used}% used` : `${100 - used}% left`;
}

/** Bar fill 0..100: always the same number `limitText` prints, so the bar never contradicts it. */
export function limitFill(usedPercent: number, view: LimitView): number {
  const used = Math.round(Math.max(0, Math.min(100, usedPercent)));
  return view === "used" ? used : 100 - used;
}
