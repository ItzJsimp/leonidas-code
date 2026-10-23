// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { PaneDivider } from "./PaneDivider";

let root: Root;
let host: HTMLDivElement;
const onChange = vi.fn();
const onDrag = vi.fn();
const container = {
  current: { getBoundingClientRect: () => ({ left: 0, width: 1000 }) } as HTMLElement,
};

const fire = (element: Element, type: string, clientX = 0) =>
  act(async () => {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, button: 0 }));
  });

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.hasPointerCapture = () => true;
  onChange.mockReset();
  onDrag.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = () =>
  act(async () => {
    root.render(
      <PaneDivider ratio={0.5} containerRef={container} onDrag={onDrag} onChange={onChange} />,
    );
  });

it("shows the drag live but writes the ratio once, on pointer up", async () => {
  await render();
  const bar = host.querySelector("[role='separator']")!;
  await fire(bar, "pointerdown", 500);
  await fire(bar, "pointermove", 600);
  await fire(bar, "pointermove", 700);
  expect(onDrag).toHaveBeenCalledTimes(2);
  expect(onChange).not.toHaveBeenCalled();
  await fire(bar, "pointerup", 700);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0]![0]).toBeCloseTo(0.64, 2);
});

it("writes a key step at once and has a 24 px hit zone", async () => {
  await render();
  const bar = host.querySelector("[role='separator']")!;
  await act(async () => {
    bar.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }));
  });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(bar.querySelector("[data-hit]")?.className).toContain("w-6");
});
