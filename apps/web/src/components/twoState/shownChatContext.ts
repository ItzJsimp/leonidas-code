import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { createContext, use, useMemo } from "react";

import { useTwoStateStore } from "./twoStateStore";

/** The chat the pane shows when the URL has none (a remembered chat beside a window). */
export const ShownChatContext = createContext<ScopedThreadRef | null>(null);

/** The chat from the URL, else the chat the pane shows. */
export const useRouteOrShownThreadRef = (
  urlRef: ScopedThreadRef | null,
): ScopedThreadRef | null => {
  const shown = use(ShownChatContext);
  return urlRef ?? shown;
};

/** The last chat the user had open, for code outside the chat pane (the root key handlers). */
export const useRememberedThreadRef = (): ScopedThreadRef | null => {
  const last = useTwoStateStore((state) => state.lastThread);
  return useMemo(
    () =>
      last ? scopeThreadRef(last.environmentId as EnvironmentId, last.threadId as ThreadId) : null,
    [last],
  );
};
