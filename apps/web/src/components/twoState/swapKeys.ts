/** Which state the current page is: the Command Center, a chat, or another page. */
export type TwoStateView = "cc" | "code" | "other";

export interface ThreadPlace {
  readonly environmentId: string;
  readonly threadId: string;
}

/** Where the swap key goes. From the Command Center it returns to the last chat, if there is one. */
export function swapTarget(
  view: TwoStateView,
  lastThread: ThreadPlace | null,
): { readonly to: "cc" } | ({ readonly to: "thread" } & ThreadPlace) | null {
  if (view !== "cc") return { to: "cc" };
  return lastThread ? { to: "thread", ...lastThread } : null;
}

/** The desktop app gets Ctrl+Tab. A browser keeps Ctrl+Tab for its own tabs. */
export const swapKeyLabel = (desktop: boolean) => (desktop ? "Ctrl Tab" : "Ctrl Shift .");
