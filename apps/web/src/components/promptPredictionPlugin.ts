import { closeHistory } from "@tiptap/pm/history";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { predictPrompt, type PromptCandidate } from "@t3tools/shared/promptPrediction";

export const promptPredictionKey = new PluginKey<{ suggestion: string | null; dismissed: boolean }>(
  "leonidas-prompt-prediction",
);

function suggestionFor(
  state: EditorState,
  candidates: readonly PromptCandidate[],
  enabled: boolean,
) {
  const { doc, selection } = state;
  if (
    !enabled ||
    !selection.empty ||
    selection.from !== doc.content.size - 1 ||
    [...Array(doc.childCount)].some((_, index) => {
      const paragraph = doc.child(index);
      return (
        paragraph.type.name !== "paragraph" ||
        paragraph.childCount > 1 ||
        (paragraph.firstChild &&
          (!paragraph.firstChild.isText || paragraph.firstChild.marks.length > 0))
      );
    })
  )
    return null;
  const paragraphs = [...Array(doc.childCount)].map((_, index) => doc.child(index).textContent);
  const fullDraft = paragraphs.join("\n");
  const lastParagraph = paragraphs.at(-1) ?? "";
  if (/^[\s]*[/$@]/.test(lastParagraph)) return null;
  const fullMatch =
    paragraphs.length > 1
      ? candidates.find(
          (candidate) =>
            candidate.text.startsWith(fullDraft) && candidate.text.length > fullDraft.length,
        )
      : null;
  if (fullMatch) return fullMatch.text.slice(fullDraft.length);
  return predictPrompt(candidates, lastParagraph)?.slice(lastParagraph.length) ?? null;
}

export function createPromptPredictionPlugin(options: {
  candidates: () => readonly PromptCandidate[];
  enabled: () => boolean;
}) {
  return new Plugin({
    key: promptPredictionKey,
    state: {
      init: (_, state) => ({
        suggestion: suggestionFor(state, options.candidates(), options.enabled()),
        dismissed: false,
      }),
      apply: (tr, previous, _, state) => {
        const dismissed = tr.docChanged
          ? false
          : tr.getMeta(promptPredictionKey) === "dismiss" || previous.dismissed;
        return {
          dismissed,
          suggestion: dismissed
            ? null
            : suggestionFor(state, options.candidates(), options.enabled()),
        };
      },
    },
    props: {
      decorations: (state) => {
        const suggestion = promptPredictionKey.getState(state)?.suggestion;
        if (!suggestion) return DecorationSet.empty;
        return DecorationSet.create(state.doc, [
          Decoration.widget(
            state.selection.from,
            (view) => {
              const wrapper = document.createElement("span");
              wrapper.className = "cursor-pointer select-none";
              wrapper.title = "Click to accept the suggestion";
              wrapper.setAttribute("aria-hidden", "true");
              // mousedown, not click, so the editor keeps focus; the same insert Tab makes.
              wrapper.addEventListener("mousedown", (event) => {
                event.preventDefault();
                view.dispatch(closeHistory(view.state.tr).insertText(suggestion).scrollIntoView());
                view.focus();
              });
              const ghost = document.createElement("span");
              ghost.className = "text-placeholder/75";
              ghost.textContent = suggestion;
              // Keycap, outside the ghost text: it is chrome, never part of what Tab inserts.
              const keycap = document.createElement("kbd");
              keycap.className =
                "ml-3 inline-flex h-[18px] -translate-y-px items-center rounded border border-border bg-muted px-1.5 align-middle font-mono text-[10px] font-semibold leading-none text-muted-foreground shadow-[0_1px_0_0_var(--color-border)]";
              keycap.textContent = "Tab";
              wrapper.append(ghost, keycap);
              return wrapper;
            },
            { side: 1, key: suggestion, ignoreSelection: true },
          ),
        ]);
      },
      handleKeyDown: (view, event) => {
        const suggestion = promptPredictionKey.getState(view.state)?.suggestion;
        if (
          !suggestion ||
          event.isComposing ||
          view.composing ||
          event.shiftKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          !options.enabled()
        )
          return false;
        if (event.key === "Escape") {
          view.dispatch(view.state.tr.setMeta(promptPredictionKey, "dismiss"));
          return true;
        }
        if (event.key !== "Tab") return false;
        view.dispatch(closeHistory(view.state.tr).insertText(suggestion).scrollIntoView());
        return true;
      },
    },
  });
}
