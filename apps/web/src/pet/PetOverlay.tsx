import { useEffect, useRef, useState } from "react";

import { useClientSettings } from "../hooks/useSettings";
import type { PetState } from "./petAtlas";
import { PetPlayer } from "./PetPlayer";
import { type PetAnchor, usePetSignalStore } from "./petSignal";

const ANCHOR_LEFT: Readonly<Record<PetAnchor, string>> = {
  left: "12%",
  center: "50%",
  right: "88%",
};
const ANCHOR_ORDER: readonly PetAnchor[] = ["left", "center", "right"];
const WALK_MS = 700;

/**
 * Bottom-edge pet, mounted once at the app root and rendered only when the user opts in. It
 * walks (one CSS transition, no repaint loop) to the anchor matching what the agent is doing.
 */
export function PetOverlay() {
  const petEnabled = useClientSettings((settings) => settings.petEnabled);
  const { state, text, anchor } = usePetSignalStore((store) => store.signal);
  const previousAnchor = useRef(anchor);
  const [walking, setWalking] = useState<PetState | null>(null);

  useEffect(() => {
    const from = ANCHOR_ORDER.indexOf(previousAnchor.current);
    const to = ANCHOR_ORDER.indexOf(anchor);
    previousAnchor.current = anchor;
    if (from === to) return;
    setWalking(to > from ? "running-right" : "running-left");
    const timer = setTimeout(() => setWalking(null), WALK_MS);
    return () => clearTimeout(timer);
  }, [anchor]);

  if (!petEnabled) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-40">
      <div
        className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center transition-[left] ease-in-out"
        style={{ left: ANCHOR_LEFT[anchor], transitionDuration: `${WALK_MS}ms` }}
      >
        {text && (
          <div className="mb-1 max-w-56 truncate rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
            {text}
          </div>
        )}
        <PetPlayer state={walking ?? state} />
      </div>
    </div>
  );
}
