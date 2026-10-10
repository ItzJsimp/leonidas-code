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
    doc.childCount !== 1 ||
    doc.firstChild?.type.name !== "paragraph" ||
    selection.from !== doc.content.size - 1 ||
    doc.firstChild.childCount > 1 ||
    (doc.firstChild.firstChild &&
      (!doc.firstChild.firstChild.isText || doc.firstChild.firstChild.marks.length > 0))
  )
    return null;
  return predictPrompt(candidates, doc.textContent)?.slice(doc.textContent.length) ?? null;
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
            () => {
              const span = document.createElement("span");
              span.className = "pointer-events-none text-placeholder/75";
              span.setAttribute("aria-hidden", "true");
              span.textContent = suggestion;
              const hint = document.createElement("span");
              hint.className = "ml-2 text-xs";
              hint.textContent = "Tab";
              span.append(hint);
              return span;
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
