// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { tourStops } from "../../../onboarding/setupCopy";
import { SetupTour } from "./SetupTour";

let root: Root;
let container: HTMLDivElement;
const onClose = vi.fn();

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

async function render(voice: "everyday" | "builder" = "everyday") {
  await act(async () =>
    root.render(
      <SetupTour
        stops={tourStops(voice)}
        intro="A quick look around."
        extra={{ memory: ["It knows: I run a business"] }}
        onClose={onClose}
      />,
    ),
  );
}

const dialog = () => container.querySelector('[role="dialog"]') as HTMLElement;
const title = () => container.querySelector("#setup-tour-title")?.textContent;

async function press(key: string) {
  await act(async () =>
    dialog().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })),
  );
}

it("walks the stops with the keyboard and shows the user's own data", async () => {
  await render();
  expect(document.activeElement).toBe(dialog());
  expect(title()).toBe("Home");
  expect(container.textContent).toContain("1 of 5");
  await press("ArrowRight");
  await press("ArrowRight");
  expect(title()).toBe("Memory");
  expect(container.textContent).toContain("It knows: I run a business");
  await press("ArrowLeft");
  expect(title()).toBe("Chats");
});

it("shows 8 stops to builders and closes on Done", async () => {
  await render("builder");
  for (let step = 0; step < 7; step += 1) await press("ArrowRight");
  expect(container.textContent).toContain("8 of 8");
  const done = [...container.querySelectorAll("button")].find((b) => b.textContent === "Done");
  await act(async () => done?.click());
  expect(onClose).toHaveBeenCalledOnce();
});

it("skips on Escape", async () => {
  await render();
  await press("Escape");
  expect(onClose).toHaveBeenCalledOnce();
});
