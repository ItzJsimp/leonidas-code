import { create } from "zustand";

import { DEFAULT_SIDEBAR_VIEW, parseSidebarView, type SidebarView } from "./sidebarView.logic";

// Per device, like the other sidebar shelf toggles: a laptop and a desktop
// can want different densities.
const SIDEBAR_VIEW_KEY = "leonidas:sidebar:view";

function readStoredView(): SidebarView {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_VIEW;
  try {
    return parseSidebarView(window.localStorage.getItem(SIDEBAR_VIEW_KEY));
  } catch {
    return DEFAULT_SIDEBAR_VIEW;
  }
}

function writeStoredView(view: SidebarView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_VIEW_KEY, JSON.stringify(view));
  } catch {
    // Storage full or blocked: the choice still applies for this session.
  }
}

interface SidebarViewStore {
  readonly view: SidebarView;
  readonly setView: (patch: Partial<SidebarView>) => void;
  readonly resetView: () => void;
}

export const useSidebarViewStore = create<SidebarViewStore>((set, get) => ({
  view: readStoredView(),
  setView: (patch) => {
    const view = { ...get().view, ...patch };
    writeStoredView(view);
    set({ view });
  },
  resetView: () => {
    writeStoredView(DEFAULT_SIDEBAR_VIEW);
    set({ view: DEFAULT_SIDEBAR_VIEW });
  },
}));
