import { create } from "zustand";

import { COMMUNITY_URL } from "../feedback/feedbackRelay";

/** Open state for the "I'm stuck" dialog. The button, the palette and the phrase all call `openStuck`. */
export const useStuckStore = create<{ source: "button" | "voice" | null }>(() => ({
  source: null,
}));

/** False in builds without the community Worker: every entry point hides itself. */
export const STUCK_ENABLED = COMMUNITY_URL !== "";

export function openStuck(source: "button" | "voice"): void {
  if (STUCK_ENABLED) useStuckStore.setState({ source });
}

export function closeStuck(): void {
  useStuckStore.setState({ source: null });
}
