import { create } from "zustand";

import { FEEDBACK_ENABLED } from "./feedbackRelay";

interface FeedbackRequest {
  /** Where the dialog was opened from, sent with the report (for example "hotkey"). */
  readonly source?: string;
  readonly initialText?: string;
  /** Preselects the kind of report, for entry points that already know (an error is a bug). */
  readonly type?: "bug" | "idea" | "suggestion";
}

/** Open state for the feedback dialog; any entry point (keybinding, palette) calls `openFeedback`. */
export const useFeedbackStore = create<{ request: FeedbackRequest | null }>(() => ({
  request: null,
}));

export function openFeedback(request: FeedbackRequest = {}): void {
  if (!FEEDBACK_ENABLED) return;
  useFeedbackStore.setState({ request });
}

export function closeFeedback(): void {
  useFeedbackStore.setState({ request: null });
}
