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
      if (!composer.insertTextAtEnd(text, { ensureLeadingBoundary: true })) {
        toastManager.add({
          type: "error",
          title: "Unable to add reply",
          description: "The composer is busy; try again once it is ready.",
        });
        return;
      }
      scheduleComposerFocus();
    },
    [composerRef, scheduleComposerFocus],
  );
  return { useArtifactTemplate, fillDockReply };
}
