import { useCallback, type RefObject } from "react";
import type { ChatComposerHandle } from "./ChatComposer";
import type { CodexArtifactTemplate } from "@t3tools/shared/codexArtifactTemplates";
import { codexArtifactTemplatePromptToAppend } from "../ChatView.logic";
import { toastManager } from "../ui/toast";

export function useComposerOutputActions(
  composerRef: RefObject<ChatComposerHandle | null>,
  scheduleComposerFocus: () => void,
) {
  const useArtifactTemplate = useCallback(
    (template: CodexArtifactTemplate) => {
      const composer = composerRef.current;
      if (!composer) return;

      const currentDraft = composer.getSendContext().prompt;
      const prompt = codexArtifactTemplatePromptToAppend(currentDraft, template);
      if (prompt !== null && !composer.insertTextAtEnd(prompt, { ensureLeadingBoundary: true })) {
        toastManager.add({
          type: "error",
          title: "Unable to add to chat",
          description: "The composer is busy; try again once it is ready.",
        });
        return;
      }
      scheduleComposerFocus();
    },
    [composerRef, scheduleComposerFocus],
  );
  const fillDockReply = useCallback(
    (text: string) => {
      const composer = composerRef.current;
      if (!composer) return;
      // shortcut: a caret at 0 in a non-empty draft counts as no caret, so the text goes to
      // the end; track real caret placement if someone needs inserts at the very start.
      const { value, expandedCursor } = composer.readSnapshot();
      const options = { ensureLeadingBoundary: true };
      // The insert itself focuses the editor right after the new text.
      const inserted =
        value.length > 0 && expandedCursor === 0
          ? composer.insertTextAtEnd(text, options)
          : composer.insertTextAtCursor(text, options);
      if (!inserted) {
        toastManager.add({
          type: "error",
          title: "Unable to add reply",
          description: "The composer is busy; try again once it is ready.",
        });
      }
    },
    [composerRef],
  );
  return { useArtifactTemplate, fillDockReply };
}
