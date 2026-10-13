import { useEffect, useRef } from "react";

/**
 * Slow red-to-blue lava-lamp backdrop for the tasks window. Only `transform`
 * animates (compositor-only, no repaint); the loop pauses while the window is
 * hidden and under reduced-motion, leaving the static gradient.
 */
export function TaskBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      ref.current?.toggleAttribute("data-paused", document.hidden);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <div ref={ref} aria-hidden className="task-backdrop">
      <span className="task-backdrop__blob task-backdrop__blob--red" />
      <span className="task-backdrop__blob task-backdrop__blob--violet" />
      <span className="task-backdrop__blob task-backdrop__blob--blue" />
    </div>
  );
}
