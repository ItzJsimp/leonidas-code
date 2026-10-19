import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import type { FocusScope, Point, Size } from "./focusWidget.logic";

/** A quick capture aimed at the notepad: show it, put the cursor in the Add box, fill in the text. */
export interface FocusCaptureRequest {
  readonly text: string;
  /** True when the notepad was hidden before the capture, so it hides again after the note is added. */
  readonly hideAfterAdd: boolean;
  readonly nonce: number;
}

interface FocusWidgetState {
  /** How many chat views can show the widget right now. Not saved. */
  hosts: number;
  capture: FocusCaptureRequest | null;
  registerHost: () => () => void;
  requestCapture: (text: string) => void;
  clearCapture: () => void;
  visible: boolean;
  /** `null` is docked at the top right of the chat. */
  position: Point | null;
  scope: FocusScope;
  /** `null` is the default size; the user sets it by dragging the bottom right corner. */
  size: Size | null;
  setSize: (size: Size | null) => void;
  setVisible: (visible: boolean) => void;
  setPosition: (position: Point | null) => void;
  setScope: (scope: FocusScope) => void;
}

/** Per machine: each window remembers where the user put the widget. */
let captureNonce = 0;

export const useFocusWidgetStore = create<FocusWidgetState>()(
  persist(
    (set, get) => ({
      hosts: 0,
      capture: null,
      registerHost: () => {
        set((state) => ({ hosts: state.hosts + 1 }));
        return () => set((state) => ({ hosts: Math.max(0, state.hosts - 1) }));
      },
      requestCapture: (text) =>
        set({
          visible: true,
          capture: { text, hideAfterAdd: !get().visible, nonce: ++captureNonce },
        }),
      clearCapture: () => set({ capture: null }),
      visible: false,
      position: null,
      scope: "project",
      size: null,
      setSize: (size) => set({ size }),
      setVisible: (visible) => set({ visible }),
      setPosition: (position) => set({ position }),
      setScope: (scope) => set({ scope }),
    }),
    {
      name: "leonidas:focus-widget:v1",
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({
        visible: state.visible,
        position: state.position,
        scope: state.scope,
        size: state.size,
      }),
    },
  ),
);
