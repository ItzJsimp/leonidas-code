import { useEffect, useEffectEvent } from "react";

/**
 * Calls `tick` every `ms` while the window is showing. A hidden window arms no timer, and coming
 * back to it calls `tick` once so the view is current before the next interval fires.
 */
export function useVisibleInterval(tick: () => void, ms: number, enabled = true): void {
  const onTick = useEffectEvent(tick);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const arm = () => {
      clearInterval(timer);
      timer = document.visibilityState === "visible" ? setInterval(onTick, ms) : undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onTick();
      arm();
    };
    arm();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, ms]);
}
