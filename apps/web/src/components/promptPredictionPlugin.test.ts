import { describe, expect, it } from "vite-plus/test";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import type { EditorView } from "@tiptap/pm/view";
import { createPromptPredictionPlugin, promptPredictionKey } from "./promptPredictionPlugin";

const schema = new Schema({
  nodes: { doc: { content: "paragraph+" }, paragraph: { content: "text*" }, text: {} },
});
const candidates = [{ text: "Run the tests", count: 2, lastSeen: 1 }];
function setup(text = "Run", enabled = true) {
  const plugin = createPromptPredictionPlugin({
    candidates: () => candidates,
    enabled: () => enabled,
  });
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, text ? schema.text(text) : undefined),
  ]);
  let state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, doc.content.size - 1),
    plugins: [history(), plugin],
  });
  const view = {
    get state() {
      return state;
    },
    dispatch(tr: Parameters<EditorView["dispatch"]>[0]) {
      state = state.apply(tr);
    },
  } as EditorView;
  const key = (key: string, extra = {}) =>
    plugin.props.handleKeyDown?.call(plugin, view, { key, ...extra } as KeyboardEvent);
  return { view, key, plugin };
}
describe("prompt prediction editor", () => {
  it("keeps ghost text out of the draft until Tab, with one undo step", () => {
    const { view, key } = setup();
    expect(view.state.doc.textContent).toBe("Run");
    expect(promptPredictionKey.getState(view.state)?.suggestion).toBe(" the tests");
    expect(key("Enter")).toBe(false);
    expect(key("Tab")).toBe(true);
    expect(view.state.doc.textContent).toBe("Run the tests");
    undo(view.state, view.dispatch);
    expect(view.state.doc.textContent).toBe("Run");
  });
  it("undoing acceptance preserves the prefix typed immediately before it", () => {
    const { view, key } = setup("Ru");
    view.dispatch(view.state.tr.insertText("n"));
    expect(key("Tab")).toBe(true);
    undo(view.state, view.dispatch);
    expect(view.state.doc.textContent).toBe("Run");
  });
  it("dismisses with Escape until the draft changes", () => {
    const { view, key } = setup();
    expect(key("Escape")).toBe(true);
    expect(key("Tab")).toBe(false);
    view.dispatch(view.state.tr.insertText(" "));
    expect(promptPredictionKey.getState(view.state)?.suggestion).toBe("the tests");
  });
  it("leaves modified Tab, composition, disabled editors and selections alone", () => {
    const { view, key } = setup();
    expect(key("Tab", { shiftKey: true })).toBe(false);
    expect(key("Tab", { isComposing: true })).toBe(false);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 3)));
    expect(key("Tab")).toBe(false);
    expect(setup("Run", false).key("Tab")).toBe(false);
  });
  it("does not suggest while the caret is in the middle", () => {
    const { view } = setup();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    expect(promptPredictionKey.getState(view.state)?.suggestion).toBeNull();
  });
});
