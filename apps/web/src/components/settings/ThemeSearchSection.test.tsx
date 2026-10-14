// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const themes = vi.hoisted(() => ({
  search: vi.fn(async (_query: string, _options: unknown) => []),
}));
vi.mock("../../openVsxThemes", () => ({
  searchOpenVsxThemes: themes.search,
  importOpenVsxThemeExtension: vi.fn(),
}));

import { ThemeSearchSection } from "./ThemeSearchSection";

it("searches when the Search button is clicked, without pressing Enter", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ThemeSearchSection open onInstalled={() => {}} />);
  });
  const button = () =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (node) => node.textContent === "Search",
    )!;
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Search Open VSX themes"]',
  )!;
  expect(button().disabled).toBe(true);

  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setValue.call(input, "nord");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(button().disabled).toBe(false);

  themes.search.mockClear();
  await act(async () => button().click());
  expect(themes.search).toHaveBeenCalledWith("nord", expect.anything());

  await act(async () => root.unmount());
  container.remove();
});
