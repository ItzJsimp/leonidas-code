import { useEffect } from "react";

import { readLocalApi } from "~/localApi";
import { toastManager } from "~/components/ui/toast";
import { FEEDBACK_ENABLED } from "./feedbackRelay";
import { openFeedback } from "./feedbackStore";

const EXCERPT_CHARS = 600;

/** Prefill for a report about a specific message or error: the comment goes first, the quote after. */
export function buildAboutPrefill(kind: "message" | "error", text: string): string {
  const excerpt = text.trim().replace(/\s+/g, " ").slice(0, EXCERPT_CHARS);
  if (!excerpt) return "";
  return `\n\n---\nAbout this ${kind}:\n> ${excerpt}`;
}

/**
 * Right-click a chat message or the error banner to report it. A text selection keeps the normal
 * menu so Copy still works; the dialog shows (and lets the user edit) everything it will send.
 */
export function useFeedbackContextMenu(): void {
  useEffect(() => {
    if (!FEEDBACK_ENABLED) return;
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      if (window.getSelection()?.toString()) return;
      const errorElement = event.target.closest("[data-feedback-error]");
      const messageElement = errorElement ? null : event.target.closest("[data-message-id]");
      const element = errorElement ?? messageElement;
      const api = readLocalApi();
      if (!element || api === undefined) return;
      const kind = errorElement ? "error" : "message";
      const text = element.textContent ?? "";
      event.preventDefault();
      void api.contextMenu
        .show(
          [
            { id: "report", label: `Report this ${kind}` },
            { id: "copy", label: `Copy ${kind}` },
          ],
          { x: event.clientX, y: event.clientY },
        )
        .then((clicked) => {
          if (clicked === "report") {
            openFeedback({
              source: `right-click ${kind}`,
              initialText: buildAboutPrefill(kind, text),
              ...(errorElement ? { type: "bug" as const } : {}),
            });
          } else if (clicked === "copy") {
            void navigator.clipboard.writeText(text.trim()).catch(() => {
              toastManager.add({ type: "error", title: "Could not copy" });
            });
          }
        });
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);
}
