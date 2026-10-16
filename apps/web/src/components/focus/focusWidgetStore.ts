import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import type { FocusScope, Point } from "./focusWidget.logic";

interface FocusWidgetState {
  visible: boolean;
  /** `null` is docked at the top right of the chat. */
  position: Point | null;
  scope: FocusScope;
  setVisible: (visible: boolean) => void;
  setPosition: (position: Point | null) => void;
  setScope: (scope: FocusScope) => void;
}

/** Per machine: each window remembers where the user put the widget. */
export const useFocusWidgetStore = create<FocusWidgetState>()(
  persist(
    (set) => ({
      visible: false,
      position: null,
      scope: "project",
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
      }),
    },
  ),
);
