// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { WizardPanel } from "./wizard";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
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

describe("WizardPanel stableHeight", () => {
  it("keeps a minimum height and pins the last child to the bottom", async () => {
    await act(async () =>
      root.render(
        <WizardPanel stableHeight>
          <h1>Title</h1>
          <div data-testid="footer">Footer</div>
        </WizardPanel>,
      ),
    );
    const stable = container.querySelector('[data-slot="wizard-stable-content"]');
    expect(stable).not.toBeNull();
    expect(stable?.className).toContain("flex-col");
    expect(stable?.className).toMatch(/min-h-\[/);
    expect(stable?.className).toContain("[&>:last-child]:mt-auto");
    expect(stable?.querySelector('[data-testid="footer"]')).not.toBeNull();
  });

  it("does not add the stable wrapper by default", async () => {
    await act(async () => root.render(<WizardPanel>content</WizardPanel>));
    expect(container.querySelector('[data-slot="wizard-stable-content"]')).toBeNull();
  });
});
