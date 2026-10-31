// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import { EXPLAIN_SIMPLER_REPLY, OutputDock } from "./AssistantOutput";
import { parseOutputDock } from "@t3tools/shared/outputDock";

it("fills options, quick replies and Start, and shows old actions as plain lines", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onReply = vi.fn();
  const dock = parseOutputDock(`Body
### 🎯 TL;DR
- Ready
### ⚡ Immediate Next Actions
- [ ] 🤖 **Leonidas:** Run tests.
### ❓ Input & Decisions Needed
- **A)** Keep it.
💬 Quick Replies: "Why A?"`)!;
  const done = parseOutputDock(`Shipped.
### 🎯 TL;DR
- Live
### 🏁 Session Complete
✅ Done. Next best move: retire jake.md.`)!;
  const button = (label: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
  try {
    await act(() =>
      root.render(
        <>
          <OutputDock
            sections={dock.sections}
            onReply={onReply}
            renderMarkdown={(text) => <span>{text}</span>}
          />
          <OutputDock
            sections={done.sections}
            onReply={onReply}
            renderMarkdown={(text) => <span>{text}</span>}
          />
        </>,
      ),
    );
    expect(container.querySelector('[role="checkbox"]')).toBeNull();
    expect(container.textContent).toContain("- 🤖 **Leonidas:** Run tests.");
    for (const label of ["Choose A", "Why A?", "Start"]) await act(() => button(label).click());
    expect(onReply.mock.calls).toEqual([
      ["Option A: Keep it"],
      ["Why A?"],
      ["Start: retire jake.md"],
    ]);
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("shows the slim Dock below builder level: undo and explain simpler, no chips or checkboxes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onReply = vi.fn();
  const onUndo = vi.fn();
  const dock = parseOutputDock(`Done.
### 🎯 TL;DR
- Ready
🔁 Assumed: "Blue theme"
### ⚡ Immediate Next Actions
- [ ] 🤖 **Leonidas:** Run tests.`)!;
  const render = (simple: boolean) =>
    act(() =>
      root.render(
        <OutputDock
          sections={dock.sections}
          onReply={onReply}
          onUndo={onUndo}
          simple={simple}
          renderMarkdown={(text) => <span>{text}</span>}
        />,
      ),
    );
  const button = (label: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === label);
  try {
    await render(true);
    expect(container.querySelector('[role="checkbox"]')).toBeNull();
    expect(button("Blue theme")).toBeUndefined();
    await act(() => button("Explain simpler")!.click());
    expect(onReply).toHaveBeenLastCalledWith(EXPLAIN_SIMPLER_REPLY);
    await act(() => button("Undo this turn")!.click());
    expect(onUndo).toHaveBeenCalledOnce();

    await render(false);
    expect(container.querySelector('[role="checkbox"]')).toBeNull();
    expect(button("Explain simpler")).toBeUndefined();
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
