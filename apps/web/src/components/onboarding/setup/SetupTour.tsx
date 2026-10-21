import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import type { TourStop } from "../../../onboarding/setupCopy";
import { Button } from "../../ui/button";

const CARD_WIDTH = 360;
const GAP = 12;

function findTarget(stop: TourStop): DOMRect | null {
  const node = document.querySelector(`[data-tour="${stop.target}"]`);
  const rect = node?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

/** Below the target when there is room, else above it. No target: centered. */
function cardPosition(rect: DOMRect | null): CSSProperties {
  if (!rect) return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  const left = Math.min(Math.max(rect.left, 16), window.innerWidth - CARD_WIDTH - 16);
  return rect.bottom < window.innerHeight * 0.6
    ? { left, top: rect.bottom + GAP }
    : { left, bottom: window.innerHeight - rect.top + GAP };
}

/**
 * A guided tour over the real app: one area at a time, one line on what it does and why.
 * Escape skips, arrow keys move. A stop whose area is not on screen shows as a centered card.
 */
export function SetupTour({
  stops,
  intro,
  extra,
  onClose,
}: {
  readonly stops: readonly TourStop[];
  readonly intro: string;
  /** The user's own data for a stop, by stop id. */
  readonly extra?: Readonly<Record<string, readonly string[]>>;
  readonly onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const stop = stops[index];
  const last = index === stops.length - 1;

  useLayoutEffect(() => {
    if (!stop) return;
    const update = () => setRect(findTarget(stop));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [stop]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  if (!stop) return null;
  const next = () => (last ? onClose() : setIndex(index + 1));
  const back = () => setIndex(Math.max(index - 1, 0));
  const lines = extra?.[stop.id] ?? [];

  return (
    <div className="fixed inset-0 z-50">
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-300 ease-out"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/55" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-tour-title"
        tabIndex={-1}
        className="absolute space-y-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none"
        style={{ width: CARD_WIDTH, maxWidth: "calc(100vw - 32px)", ...cardPosition(rect) }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          else if (event.key === "ArrowRight") next();
          else if (event.key === "ArrowLeft") back();
          else return;
          event.preventDefault();
        }}
      >
        {index === 0 ? <p className="text-xs text-muted-foreground">{intro}</p> : null}
        <h2 id="setup-tour-title" className="text-base font-semibold">
          {stop.title}
        </h2>
        <p className="text-sm">{stop.line}</p>
        {lines.length > 0 ? (
          <ul className="space-y-1 rounded-lg bg-muted/50 p-2 text-xs">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {index + 1} of {stops.length}
          </span>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Skip tour
            </Button>
            {index > 0 ? (
              <Button variant="outline" size="sm" onClick={back}>
                Back
              </Button>
            ) : null}
            <Button size="sm" onClick={next}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
