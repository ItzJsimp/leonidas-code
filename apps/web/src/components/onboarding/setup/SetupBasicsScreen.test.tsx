// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { DEFAULT_AIOS_FOLDER } from "../../../onboarding/leonidasSetup.logic";
import { SetupBasicsScreen, type SetupBasics } from "./SetupBasicsScreen";

let root: Root;
let container: HTMLDivElement;
const onContinue = vi.fn<(basics: SetupBasics) => void>();
const onReturning = vi.fn();

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

async function render(
  options: {
    editorIds?: readonly string[];
    pickFolder?: () => Promise<string | null>;
    resolveFolder?: (folder: string) => Promise<string>;
  } = {},
) {
  await act(async () =>
    root.render(
      <SetupBasicsScreen
        editorIds={options.editorIds ?? []}
        onContinue={onContinue}
        onReturning={onReturning}
        pickFolder={options.pickFolder}
        resolveFolder={options.resolveFolder}
      />,
    ),
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

it("asks no coder question, so the words never change", async () => {
  await render();
  expect(container.textContent).not.toContain("build software");
  expect(container.querySelector('[role="radio"]')).toBeNull();
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

it("takes the tour depth from installed code editors without asking", async () => {
  await render({ editorIds: ["vscode"] });
  await act(async () => button("Continue").click());
  expect(onContinue.mock.calls[0]?.[0].coder).toBe(true);
});

it("shows a first-name placeholder and offers the user's own AI name as one click", async () => {
  await render();
  expect(input("Your first name").placeholder).toBe("Your first name");
  await type(input("Your first name"), "Jake");
  await act(async () => button("Jake's AI").click());
  expect(input("Name your AI").value).toBe("Jake's AI");
});

it("needs an AI name to continue", async () => {
  await render();
  await type(input("Name your AI"), "  ");
  expect(button("Continue").disabled).toBe(true);
});

it("shows the real folder path from the computer", async () => {
  await render({ resolveFolder: async () => "C:\\Users\\Jake\\Leonidas AIOS" });
  expect(container.textContent).toContain("C:\\Users\\Jake\\Leonidas AIOS");
});

it("opens the folder picker and keeps an AIOS folder inside the chosen place", async () => {
  await render({ pickFolder: async () => "C:\\Users\\Jake\\Documents" });
  await act(async () => button("Change").click());
  await act(async () => button("Continue").click());
  expect(onContinue.mock.calls[0]?.[0].folder).toBe("C:\\Users\\Jake\\Documents\\Leonidas AIOS");
});

it("keeps the old folder when the picker is closed", async () => {
  await render({ pickFolder: async () => null });
  await act(async () => button("Change").click());
  await act(async () => button("Continue").click());
  expect(onContinue.mock.calls[0]?.[0].folder).toBe(DEFAULT_AIOS_FOLDER);
});

it("offers a way in for people who already use Leonidas", async () => {
  await render();
  await act(async () => button("Already use Leonidas on another computer?").click());
  expect(onReturning).toHaveBeenCalledOnce();
});
