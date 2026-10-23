import type { PaneLayout } from "./shellLayout";

export interface ThreadPlace {
  readonly environmentId: string;
  readonly threadId: string;
}

export type PaneName = "left" | "chat";

export type SwapAction =
  | { readonly kind: "focus"; readonly pane: PaneName }
  | { readonly kind: "cc" }
  | { readonly kind: "start" }
  | ({ readonly kind: "thread" } & ThreadPlace);

/**
 * What the swap key does. In a split it moves focus to the other pane. With one pane it shows the
 * other one: the Command Center from the chat, the last chat (or the start page) from a rail page.
 */
export function swapAction(
  input: PaneLayout & {
    readonly focused: PaneName | null;
    readonly lastThread: ThreadPlace | null;
  },
): SwapAction {
  if (input.mode === "split") {
    return { kind: "focus", pane: input.focused === "chat" ? "left" : "chat" };
  }
  if (input.show === "chat") return { kind: "cc" };
  return input.lastThread ? { kind: "thread", ...input.lastThread } : { kind: "start" };
}

/** The desktop app gets Ctrl+Tab. A browser keeps Ctrl+Tab for its own tabs. */
export const swapKeyLabel = (desktop: boolean) => (desktop ? "Ctrl Tab" : "Ctrl Shift .");
