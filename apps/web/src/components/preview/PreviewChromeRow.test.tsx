// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

import { PreviewChromeRow } from "./PreviewChromeRow";

it("shows a Go button while the address is edited, and a click submits it", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const onSubmit = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <PreviewChromeRow
        url="http://localhost:3000/"
        loading={false}
        canGoBack={false}
        canGoForward={false}
        refreshDisabled={false}
        onBack={() => {}}
        onForward={() => {}}
        onRefresh={() => {}}
        onSubmit={onSubmit}
      />,
    );
  });
  const go = () => container.querySelector<HTMLButtonElement>('[aria-label="Go to address"]');
  const input = container.querySelector<HTMLInputElement>("[data-preview-url-input]")!;
  expect(go()).toBeNull();

  await act(async () => input.focus());
  expect(go()).toBeNull();

  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setValue.call(input, "example.com");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(go()).not.toBeNull();

  const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  await act(async () => void go()!.dispatchEvent(mouseDown));
  expect(mouseDown.defaultPrevented).toBe(true);

  await act(async () => go()!.click());
  expect(onSubmit).toHaveBeenCalledWith("example.com");

  await act(async () => root.unmount());
  container.remove();
});
