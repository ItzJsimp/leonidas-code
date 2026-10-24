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

it("asks exactly 4 questions and shows every chip to every user", async () => {
  await render();
  expect(container.querySelectorAll("fieldset")).toHaveLength(4);
  expect(container.textContent).toContain("4 quick questions");
  expect(container.textContent).not.toContain("How should answers look");
  expect(container.textContent).toContain("A code editor");
});

it("skips without saving", async () => {
  await render();
  await act(async () => button("Skip for now").click());
  expect(onSkip).toHaveBeenCalledOnce();
  expect(onSave).not.toHaveBeenCalled();
});

it("saves only the 4 quick answers", async () => {
  await render();
  await act(async () => button("Save answers").click());
  const answers = onSave.mock.calls[0]?.[0] ?? {};
  expect(Object.keys(answers).sort()).toEqual(["avoid", "goal", "tools", "work"]);
});

it("lets the user pick many roles and add their own words", async () => {
  await render();
  await act(async () => button("I study").click());
  await act(async () => button("I create content").click());
  const others = [...container.querySelectorAll("button")].filter(
    (node) => node.textContent?.trim() === "Other",
  );
  expect(others).toHaveLength(4);
  await act(async () => others[0]?.click());
  const field = container.querySelector('input[aria-label="Other: What best describes you?"]');
  if (!(field instanceof HTMLInputElement)) throw new Error("no Other field");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(field, "I coach soccer");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => button("Save answers").click());
  expect(onSave.mock.calls[0]?.[0].work).toBe("- I create content\n- I study\n- I coach soccer");
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

it("keeps the pasted text and says why when the import cannot be saved", async () => {
  onImport.mockResolvedValueOnce("Could not save memory/imported.md.");
  await render();
  await act(async () => button("Import memory from another AI").click());
  const area = container.querySelector("textarea");
  if (!area) throw new Error("no textarea");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(area, "I like tea.");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => button("Save to memory").click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
  expect(container.querySelector("textarea")?.value).toBe("I like tea.");
  expect(button("Save to memory").disabled).toBe(false);
  expect(container.textContent).not.toContain("Memory imported.");
});
