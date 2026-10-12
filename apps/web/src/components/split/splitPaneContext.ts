import { createContext, use } from "react";

export interface SplitPaneInfo {
  /** `null` outside the split workspace (ordinary single-chat view). */
  readonly leafId: string | null;
  /** Only the focused pane answers window-level keyboard shortcuts. */
  readonly active: boolean;
}

const SINGLE_VIEW: SplitPaneInfo = { leafId: null, active: true };

export const SplitPaneContext = createContext<SplitPaneInfo>(SINGLE_VIEW);

export function useSplitPane(): SplitPaneInfo {
  return use(SplitPaneContext);
}
