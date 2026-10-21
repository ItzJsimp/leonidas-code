// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { DEFAULT_AIOS_FOLDER } from "../../../onboarding/leonidasSetup.logic";
import { SetupBasicsScreen, type SetupBasics } from "./SetupBasicsScreen";

let root: Root;
let container: HTMLDivElement;
const onContinue = vi.fn<(basics: SetupBasics) => void>();

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

async function render(editorIds: readonly string[] = []) {
  await act(async () =>
    root.render(<SetupBasicsScreen editorIds={editorIds} onContinue={onContinue} />),
  );
}

function input(label: string): HTMLInputElement {
  const found = [...container.querySelectorAll("label")].find((node) =>
    node.textContent?.includes(label),
  );
  const control = found?.querySelector("input") ?? null;
  if (!(control instanceof HTMLInputElement)) throw new Error(`no input for ${label}`);
  return control;
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

async function type(control: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("prefills the AI name and the folder, and explains the folder in one sentence", async () => {
  await render();
  expect(input("Name your AI").value).toBe("Leonidas");
  expect(container.textContent).toContain("never explain twice");
  expect(
    [...container.querySelectorAll("input")].some((node) => node.value === DEFAULT_AIOS_FOLDER),
  ).toBe(true);
});

it("continues with every default when the user changes nothing", async () => {
  await render();
  await act(async () => button("Continue").click());
  expect(onContinue).toHaveBeenCalledWith({
    aiName: "Leonidas",
    userName: "",
    folder: DEFAULT_AIOS_FOLDER,
    coder: null,
  });
});

it("needs an AI name to continue", async () => {
  await render();
  await type(input("Name your AI"), "  ");
  expect(button("Continue").disabled).toBe(true);
});

it("preselects yes when a code editor is installed, and switches to builder words", async () => {
  await render(["vscode"]);
  const checked = container.querySelector('[role="radio"][aria-checked="true"]');
  expect(checked?.closest("label")?.textContent).toContain("Yes");
  expect(container.textContent).toContain("Markdown");
  await act(async () => button("Continue").click());
  expect(onContinue.mock.calls[0]?.[0].coder).toBe(true);
});
