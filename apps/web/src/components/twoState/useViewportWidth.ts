import { useSyncExternalStore } from "react";

import { SPLIT_MIN_WIDTH } from "./shellLayout";

const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

/** The window width in px. The shell picks split, one pane or the rail drawer from it. */
export const useViewportWidth = () =>
  useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => SPLIT_MIN_WIDTH,
  );
