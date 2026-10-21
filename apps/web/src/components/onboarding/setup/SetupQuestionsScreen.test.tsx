// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { SetupQuestionsScreen } from "./SetupQuestionsScreen";

let root: Root;
let container: HTMLDivElement;
const onSave = vi.fn(async (_answers: Record<string, string | undefined>) => null as string | null);
const onSkip = vi.fn();
const onImport = vi.fn(async (_pasted: string) => null as string | null);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () =>
    root.render(
      <SetupQuestionsScreen
        voice="everyday"
        onBack={() => {}}
        onSave={onSave}
        onSkip={onSkip}
        onImport={onImport}
      />,
    ),
  );
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

it("asks exactly 5 questions", async () => {
  await render();
  expect(container.querySelectorAll("fieldset")).toHaveLength(5);
});

it("skips without saving", async () => {
  await render();
  await act(async () => button("Skip for now").click());
  expect(onSkip).toHaveBeenCalledOnce();
  expect(onSave).not.toHaveBeenCalled();
});

it("saves only the 5 quick answers", async () => {
  await render();
  await act(async () => button("Save answers").click());
  const answers = onSave.mock.calls[0]?.[0] ?? {};
  expect(Object.keys(answers).sort()).toEqual(["avoid", "goal", "style", "tools", "work"]);
});

it("offers a way on when saving fails, so setup never blocks", async () => {
  onSave.mockResolvedValueOnce("Could not use that folder.");
  await render();
  await act(async () => button("Save answers").click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not use");
  await act(async () => button("Continue without saving").click());
  expect(onSkip).toHaveBeenCalledOnce();
});

it("imports memory pasted from another AI", async () => {
  await render();
  await act(async () => button("Import memory from another AI").click());
  expect(button("Save to memory").disabled).toBe(true);
  const area = container.querySelector("textarea");
  if (!area) throw new Error("no textarea");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(area, "I like tea.");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => button("Save to memory").click());
  expect(onImport).toHaveBeenCalledWith("I like tea.");
  expect(container.textContent).toContain("Memory imported.");
});
