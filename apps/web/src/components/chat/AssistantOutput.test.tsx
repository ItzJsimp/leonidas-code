// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import { EXPLAIN_SIMPLER_REPLY, OutputDock } from "./AssistantOutput";
import { parseOutputDock } from "@t3tools/shared/outputDock";

it("prepares actions, options and replies without marking actions completed", async () => {
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
💬 Quick Replies: "Keep it"`)!;
  try {
    await act(() =>
      root.render(
        <OutputDock
          sections={dock.sections}
          onReply={onReply}
          renderMarkdown={(text) => <span>{text}</span>}
        />,
      ),
    );
    const checkbox = container.querySelector<HTMLElement>('[role="checkbox"]')!;
    await act(() => checkbox.click());
    expect(onReply).toHaveBeenLastCalledWith("Run tests.");
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    for (const label of ["Choose A", "Keep it"]) {
      const button = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === label,
      )!;
      await act(() => button.click());
    }
    expect(onReply.mock.calls).toEqual([["Run tests."], ["A"], ["Keep it"]]);
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("shows the slim Dock below builder level: chips, undo and explain simpler, no actions", async () => {
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
    await act(() => button("Blue theme")!.click());
    expect(onReply).toHaveBeenLastCalledWith('Change this: "Blue theme". Use this instead: ');
    await act(() => button("Explain simpler")!.click());
    expect(onReply).toHaveBeenLastCalledWith(EXPLAIN_SIMPLER_REPLY);
    await act(() => button("Undo this turn")!.click());
    expect(onUndo).toHaveBeenCalledOnce();

    await render(false);
    expect(container.querySelector('[role="checkbox"]')).not.toBeNull();
    expect(button("Explain simpler")).toBeUndefined();
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
