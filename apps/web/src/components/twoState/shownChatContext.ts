import type { ScopedThreadRef } from "@t3tools/contracts";
import { createContext, use } from "react";

/** The chat the pane shows when the URL has none (a remembered chat beside a window). */
export const ShownChatContext = createContext<ScopedThreadRef | null>(null);

/** The chat from the URL, else the chat the pane shows. */
export const useRouteOrShownThreadRef = (
  urlRef: ScopedThreadRef | null,
): ScopedThreadRef | null => {
  const shown = use(ShownChatContext);
  return urlRef ?? shown;
};
