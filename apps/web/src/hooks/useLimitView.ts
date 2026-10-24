export type LimitView = "used" | "left";

const NOOP = () => {};
const USED_VIEW = ["used", NOOP] as const satisfies readonly [LimitView, () => void];

/** Every usage surface shows quota used (% used); bars fill from the left as use grows. */
export function useLimitView(): readonly [LimitView, () => void] {
  return USED_VIEW;
}

/** `62% used` or `38% left` for a window's used percent. */
export function limitText(usedPercent: number, view: LimitView = "used"): string {
  const used = Math.round(Math.max(0, Math.min(100, usedPercent)));
  return view === "used" ? `${used}% used` : `${100 - used}% left`;
}
