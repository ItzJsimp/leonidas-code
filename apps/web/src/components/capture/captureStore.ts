import { create } from "zustand";

interface CaptureRequest {
  /** Where the drop came from, saved with it (for example a chat or "hotkey"). */
  readonly source?: string;
  readonly initialText?: string;
}

/** Open state for the capture dialog; any entry point (button, keybinding, palette) calls `openCapture`. */
export const useCaptureStore = create<{ request: CaptureRequest | null }>(() => ({
  request: null,
}));

export function openCapture(request: CaptureRequest = {}): void {
  useCaptureStore.setState({ request });
}

export function closeCapture(): void {
  useCaptureStore.setState({ request: null });
}
