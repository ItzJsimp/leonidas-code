// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { ReturningDevicePanel } from "./ReturningDevicePanel";

let root: Root;
let container: HTMLDivElement;
const cloneAios = vi.fn<(url: string) => Promise<string | null>>();
const onBack = vi.fn();
const onDone = vi.fn<(cloned: boolean) => void>();

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
      <ReturningDevicePanel
        folder={"C:\\Users\\Jake\\Leonidas AIOS"}
        cloneAios={cloneAios}
        pairingForm={<p>pairing form</p>}
        onBack={onBack}
        onDone={onDone}
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

async function typeUrl(value: string) {
  const control = container.querySelector("input");
  if (!(control instanceof HTMLInputElement)) throw new Error("no input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("shows both ways in: the AIOS from GitHub and the live link to the other computer", async () => {
  await render();
  expect(container.textContent).toContain("GitHub");
  expect(container.textContent).toContain("pairing form");
  expect(container.textContent).toContain("Create link");
  expect(container.textContent).toContain("C:\\Users\\Jake\\Leonidas AIOS");
});

it("copies the AIOS and reports success", async () => {
  cloneAios.mockResolvedValue(null);
  await render();
  await typeUrl(" https://github.com/jake/leonidas-aios ");
  await act(async () => button("Get my AIOS").click());
  expect(cloneAios).toHaveBeenCalledWith("https://github.com/jake/leonidas-aios");
  expect(container.textContent).toContain("Your AIOS is on this computer");
  await act(async () => button("Continue").click());
  expect(onDone).toHaveBeenCalledWith(true);
});

it("shows the error and lets the user try again", async () => {
  cloneAios.mockResolvedValue("Repository not found.");
  await render();
  await typeUrl("https://github.com/jake/missing");
  await act(async () => button("Get my AIOS").click());
  expect(container.textContent).toContain("Repository not found.");
  expect(button("Get my AIOS").disabled).toBe(false);
});

it("can continue without copying, and go back", async () => {
  await render();
  expect(button("Get my AIOS").disabled).toBe(true);
  await act(async () => button("Continue").click());
  expect(onDone).toHaveBeenCalledWith(false);
  await act(async () => button("Back").click());
  expect(onBack).toHaveBeenCalledOnce();
});
