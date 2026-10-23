// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));
vi.mock("~/hooks/useThreadActionMenu", () => ({
  useThreadActionMenu: () => ({ openMenu: vi.fn(), closeMenu: vi.fn() }),
}));
vi.mock("~/localApi", () => ({ readLocalApi: () => null }));
vi.mock("~/hooks/useSettings", () => ({ useClientSettings: () => "" }));
vi.mock("../../state/session", () => ({
  readEnvironmentScope: () => true,
  useEnvironmentScope: () => true,
}));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));
vi.mock("../../state/use-orchestration-command", () => ({
  useOrchestrationCommand: () => vi.fn(),
}));
vi.mock("../localVm/LocalVmPanel", () => ({ LocalVmPanel: () => null }));
vi.mock("../ProjectFavicon", () => ({ ProjectFavicon: () => null }));

import { ChatHeader } from "../chat/ChatHeader";
import { RailWindow } from "./RailWindow";

const STATS = /Needs you|Running|\d+ need|\d+ running/i;

describe("headers carry no stat strip", () => {
  it("the chat header shows the chat, not counts", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <ChatHeader
        activeThreadEnvironmentId={"env-1" as never}
        activeThreadId={"thread-1" as never}
        activeThreadTitle="Plan the week"
        isServerThread
        activeProject={null}
        parentThreadLink={null}
        onOpenThread={vi.fn()}
        rightPanelOpen={false}
        onNewThreadInProject={vi.fn()}
      />,
    );
    expect(host.textContent).toContain("Plan the week");
    expect(host.textContent).not.toMatch(STATS);
  });

  it("a window header shows its title, tabs and actions, not counts", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <RailWindow title="Tasks" tabs={[{ id: "all", label: "All" }]}>
        <p>body</p>
      </RailWindow>,
    );
    const header = host.querySelector("header");
    expect(header?.textContent).toBe("Tasks");
    expect(header?.textContent).not.toMatch(STATS);
    expect(host.querySelector("[aria-label='Command Center stats']")).toBeNull();
  });
});
