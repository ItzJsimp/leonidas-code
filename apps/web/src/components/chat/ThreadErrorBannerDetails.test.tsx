// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { ThreadErrorBanner } from "./ThreadErrorBanner";

const copy = vi.hoisted(() => vi.fn(async (_text: string, _label?: string) => undefined));
vi.mock("../../hooks/useCopyToClipboard", () => ({ writeTextToClipboard: copy }));

const CHAIN = "The provider could not start this turn: spawn failed Caused by: ENOENT claude.";

async function mount(error: string) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ThreadErrorBanner error={error} />);
  });
  return { container, root };
}

const trigger = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === "Details");

afterEach(() => {
  document.body.innerHTML = "";
  copy.mockClear();
});

it("shows no Details expander when the error has no cause chain", async () => {
  const { container, root } = await mount("Provider turn failed.");
  expect(trigger(container)).toBeUndefined();
  await act(async () => root.unmount());
});

it("is collapsed by default, expands to the chain, and copies the full text", async () => {
  const { container, root } = await mount(CHAIN);
  const button = trigger(container);
  expect(button).toBeDefined();
  expect(container.querySelector("[data-testid=thread-error-details]")).toBeNull();

  await act(async () => button?.click());
  const block = container.querySelector("[data-testid=thread-error-details]");
  expect(block?.textContent).toBe(
    "The provider could not start this turn: spawn failed\nCaused by: ENOENT claude.",
  );

  const copyButton = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Copy",
  );
  await act(async () => copyButton?.click());
  expect(copy).toHaveBeenCalledWith(CHAIN, "Error details");
  await act(async () => root.unmount());
});
