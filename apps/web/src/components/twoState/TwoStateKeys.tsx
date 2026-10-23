import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { isTerminalFocused } from "~/lib/terminalFocus";
import { resolveShortcutCommand } from "~/keybindings";
import { primaryServerKeybindingsAtom } from "~/state/server";

import { swapTarget, type ThreadPlace, type TwoStateView } from "./swapKeys";
import { useTwoStateStore } from "./twoStateStore";

/** Ctrl+Tab swaps the two states. Ctrl+Backslash toggles the 50/50 split. */
export function TwoStateKeys({ inChat }: { readonly inChat: boolean }) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const view: TwoStateView = inChat ? "code" : pathname === "/command-center" ? "cc" : "other";

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
      const openThread = (place: ThreadPlace) =>
        void navigate({
          to: "/$environmentId/$threadId",
          params: { environmentId: place.environmentId, threadId: place.threadId },
        });
      if (command === "layout.split") {
        setSplit(!split);
        return;
      }
      const target = swapTarget(view, lastThread);
      if (target?.to === "cc") void navigate({ to: "/command-center" });
      else if (target) openThread(target);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [keybindings, navigate, view]);

  return null;
}
