import { useLayoutEffect, useSyncExternalStore } from "react";

// The bell and split toggle draw once, at the window's top-right corner. A page whose own layout
// cluster holds that corner (a chat, the pull requests page) claims it; else the app shell draws it.
let claims = 0;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

/** Marks the corner as drawn by a page cluster. The returned function releases it once. */
export function claimShellCorner(): () => void {
  claims += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims -= 1;
    emit();
  };
}

export const isShellCornerClaimed = () => claims > 0;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Claims the corner while `active`. Layout effect, so the shell copy never paints beside it. */
export function useClaimShellCorner(active: boolean) {
  useLayoutEffect(() => (active ? claimShellCorner() : undefined), [active]);
}

export const useShellCornerClaimed = () =>
  useSyncExternalStore(subscribe, isShellCornerClaimed, () => false);
