import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { useTourStore } from "./tourStore";

const CARD_WIDTH = 300;
const CARD_GAP = 12;
const ANCHOR_RETRY_MS = 100;
const ANCHOR_RETRY_LIMIT = 20;

interface AnchorRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** Re-measures on resize and layout change only, so the ring never repaints continuously. */
function useAnchorRect(anchor: string | undefined, stepKey: number): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);
  useEffect(() => {
    setRect(null);
    if (!anchor) return;
    let element: Element | null = null;
    let observer: ResizeObserver | null = null;
    let attempts = 0;
    let timer = 0;
    const measure = () => {
      if (!element) return;
      const { top, left, width, height } = element.getBoundingClientRect();
      setRect({ top, left, width, height });
    };
    const find = () => {
      element = document.querySelector(`[data-tour="${anchor}"]`);
      if (element) {
        element.scrollIntoView({ block: "nearest" });
        measure();
        observer = new ResizeObserver(measure);
        observer.observe(element);
        return;
      }
      attempts += 1;
      if (attempts < ANCHOR_RETRY_LIMIT) timer = window.setTimeout(find, ANCHOR_RETRY_MS);
    };
    timer = window.setTimeout(find, 0);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [anchor, stepKey]);
  return rect;
}

/** Dims the app, rings the target element and explains it. Falls back to a centered card. */
export function FeatureTourSpotlight() {
  const { active, steps, index, next, stop } = useTourStore();
  const navigate = useNavigate();
  const step = active ? steps[index] : undefined;
  const rect = useAnchorRect(step?.anchor, index);

  useEffect(() => {
    if (step?.route) void navigate({ to: step.route });
  }, [navigate, step]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, stop]);

  if (!step) return null;
  const isLast = index + 1 >= steps.length;
  const placeAbove = rect !== null && rect.top > window.innerHeight / 2;
  const cardStyle = rect
    ? {
        left: Math.min(Math.max(8, rect.left), window.innerWidth - CARD_WIDTH - 8),
        ...(placeAbove
          ? { bottom: window.innerHeight - rect.top + CARD_GAP }
          : { top: rect.top + rect.height + CARD_GAP }),
      }
    : { left: "50%", top: "40%", transform: "translateX(-50%)" };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label={step.title}>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/55" />
      )}
      <div
        className="absolute space-y-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg"
        style={{ width: CARD_WIDTH, ...cardStyle }}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">{step.title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {index + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {step.tryPrompt ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  stop();
                  void navigate({ to: "/", search: { guidePrompt: step.tryPrompt } });
                }}
              >
                Try it now
              </Button>
            ) : null}
            <Button size="xs" variant="ghost" onClick={stop}>
              Skip
            </Button>
            <Button size="xs" onClick={next}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
