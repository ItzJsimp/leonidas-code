import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { isTerminalFocused } from "~/lib/terminalFocus";
import { resolveShortcutCommand } from "~/keybindings";
import { primaryServerKeybindingsAtom } from "~/state/server";

import { focusedPane, focusPane } from "./paneFocus";
import { paneLayout } from "./shellLayout";
import { swapAction } from "./swapKeys";
import { useTwoStateStore } from "./twoStateStore";

/** The swap key moves between panes. Ctrl+Backslash turns the split on or off. */
export function TwoStateKeys({ inChat }: { readonly inChat: boolean }) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: { terminalFocus: isTerminalFocused() },
      });
      if (command !== "layout.swap" && command !== "layout.split") return;
      event.preventDefault();
      event.stopPropagation();
      const { lastThread, split, setSplit } = useTwoStateStore.getState();
      if (command === "layout.split") {
        setSplit(!split);
        return;
      }
      const action = swapAction({
        ...paneLayout({
          width: window.innerWidth,
          split,
          routeKind: inChat ? "thread" : "window",
        }),
        focused: focusedPane(),
        lastThread,
      });
      if (action.kind === "focus") focusPane(action.pane);
      else if (action.kind === "cc") void navigate({ to: "/command-center" });
      else if (action.kind === "start") void navigate({ to: "/" });
      else {
        void navigate({
          to: "/$environmentId/$threadId",
          params: { environmentId: action.environmentId, threadId: action.threadId },
        });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [inChat, keybindings, navigate]);

  return null;
}
