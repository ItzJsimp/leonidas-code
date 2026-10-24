// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

const counts = vi.hoisted(() => ({ needsYou: 3 as number | null, width: 1440 }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@effect/atom-react", () => ({ useAtomValue: () => [] }));
vi.mock("~/state/server", () => ({ primaryServerKeybindingsAtom: {} }));
vi.mock("~/keybindings", () => ({ shortcutLabelForCommand: () => "Ctrl+\\" }));
vi.mock("../twoState/AppRail", () => ({ badgeText: (count: number) => String(count) }));
vi.mock("../twoState/useTwoStateData", () => ({
  useTwoStateCounts: () => ({ needsYou: counts.needsYou, running: 0, today: null }),
}));
vi.mock("../twoState/useViewportWidth", () => ({ useViewportWidth: () => counts.width }));

import { ShellCornerControls } from "./ShellCornerControls";

const render = () => {
  const element = document.createElement("div");
  element.innerHTML = renderToStaticMarkup(<ShellCornerControls />);
  return element;
};

describe("shell corner", () => {
  it("links the bell to the inbox and names the count", () => {
    const bell = render().querySelector("a[href='/inbox']");
    expect(bell?.getAttribute("aria-label")).toBe("Notifications, 3 need you");
    expect(bell?.textContent).toBe("3");
  });

  it("shows no badge while nothing needs you or the feed is loading", () => {
    for (const needsYou of [0, null]) {
      counts.needsYou = needsYou;
      const bell = render().querySelector("a[href='/inbox']");
      expect(bell?.getAttribute("aria-label")).toBe("Notifications");
      expect(bell?.textContent).toBe("");
    }
    counts.needsYou = 3;
  });

  it("offers the split view toggle only where the window can split", () => {
    expect(render().querySelector("[aria-label='Split view']")?.hasAttribute("aria-pressed")).toBe(
      true,
    );
    counts.width = 1024;
    expect(render().querySelector("[aria-label='Split view']")).toBeNull();
    counts.width = 1440;
  });
});
