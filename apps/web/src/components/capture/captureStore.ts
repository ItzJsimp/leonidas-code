import { create } from "zustand";

import { useFocusWidgetStore } from "../focus/focusWidgetStore";

interface CaptureRequest {
  /** Where the drop came from, saved with it (for example a chat or "hotkey"). */
  readonly source?: string;
  readonly initialText?: string;
}

/** Open state for the capture dialog; any entry point (button, keybinding, palette) calls `openCapture`. */
export const useCaptureStore = create<{ request: CaptureRequest | null }>(() => ({
  request: null,
}));

/**
 * Quick capture is the notepad's Add box: it shows the notepad with the cursor in that box.
 * Only a screen with no chat (so no notepad) falls back to the small dialog.
 */
export function openCapture(request: CaptureRequest = {}): void {
  const notepad = useFocusWidgetStore.getState();
  if (notepad.hosts > 0) {
    notepad.requestCapture(request.initialText ?? "");
    return;
  }
  useCaptureStore.setState({ request });
}

export function closeCapture(): void {
  useCaptureStore.setState({ request: null });
}
