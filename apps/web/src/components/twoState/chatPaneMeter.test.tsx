// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-stub="window" />,
  useLocation: () => "/chat",
  useNavigate: () => vi.fn(),
  useParams: () => false,
  useRouterState: () => "/chat",
}));
vi.mock("~/components/Sidebar", () => ({ default: () => <div data-stub="chat-list" /> }));
vi.mock("~/components/onboarding/GuidanceCoach", () => ({ GuidanceCoach: () => null }));
vi.mock("~/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/hooks/useHandleNewThread", () => ({ useHandleNewThread: () => ({}) }));
vi.mock("~/lib/chatThreadActions", () => ({ startNewThreadFromContext: vi.fn() }));
vi.mock("~/state/entities", () => ({ useThreadShell: () => null }));
vi.mock("~/state/environments", () => ({ usePrimaryEnvironmentId: () => "env-1" }));
vi.mock("~/hooks/useNowMinute", () => ({ useNowMinute: () => "2026-10-22T07:00" }));
vi.mock("~/hooks/useActiveAgentCounts", () => ({
  useActiveAgentCounts: () => (id: string) => (id === "env-1:claude-a" ? 2 : 0),
}));
vi.mock("~/hooks/useConnectedUsageAccounts", () => ({
  useConnectedUsageAccounts: () => ({
    active: [],
    others: [
      {
        id: "env-1:claude-a",
        driver: "claudeAgent",
        label: "Claude A",
        limits: { windows: [{ id: "five_hour", kind: "session", label: "S", usedPercent: 42 }] },
      },
    ],
  }),
}));
// The real chat view draws the header; this stand-in draws the same slot the real header does.
vi.mock("~/components/ThreadRouteView", async () => {
  const { useChatHeaderTrailing } = await import("~/components/chat/ChatHeaderTrailing");
  return {
    ThreadRouteView: () => <header data-chat-header>{useChatHeaderTrailing()}</header>,
  };
});
vi.mock("~/components/workspace/useActiveAiosWorkspace", () => ({
  useActiveAiosWorkspace: () => ({ active: { type: "personal", name: "Jake" } }),
}));
vi.mock("~/onboarding/useOnboardingChat", () => ({
  useOnboardingChat: () => ({ canOperate: false }),
}));
vi.mock("./useTwoStateData", () => ({
  useAiosHome: () => ({ data: null }),
  useTwoStateCounts: () => ({ needsYou: 0, running: 0, today: null }),
  useFeedStatus: () => ({ events: [], loaded: true, error: null, updatedAt: 0, refresh: () => {} }),
  useFeedEvents: () => [],
}));
vi.mock("./useLiveArea", async () => {
  const { IDLE } = await vi.importActual<typeof import("./useLiveArea")>("./useLiveArea");
  return { IDLE, useLiveArea: () => IDLE };
});
vi.mock("./useViewportWidth", () => ({ useViewportWidth: () => 1440 }));
vi.mock("./SlotOutlet", () => ({ HomeCardsOutlet: () => null }));

import { ChatPane } from "./ChatPane";
import { CommandCenterForward } from "./CommandCenterForward";
import { ShellSplit } from "./ShellSplit";

const target = { kind: "server", threadRef: { environmentId: "env-1", threadId: "t-1" } } as never;
const host = (html: string) => {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element;
};

describe("chat pane top bar", () => {
  it("shows the 5-hour meter inside the chat header", () => {
    const header = host(renderToStaticMarkup(<ChatPane urlTarget={target} />)).querySelector(
      "[data-chat-header]",
    );
    expect(header?.textContent).toContain("Claude 42% of 5 h");
    expect(header?.querySelector("[data-usage-meter]")?.getAttribute("data-level")).toBe("normal");
  });

  it("shows each account with the count of agents running on it", () => {
    const header = host(renderToStaticMarkup(<ChatPane urlTarget={target} />)).querySelector(
      "[data-chat-header]",
    );
    expect(header?.querySelector("[aria-label='Claude A, 2 active helpers']")).not.toBeNull();
  });
});

describe("the meter stays out of the left pane", () => {
  it("has no 5-hour meter on the Command Center", () => {
    const html = renderToStaticMarkup(<CommandCenterForward />);
    expect(html).not.toContain("5 h");
    expect(html).not.toContain("Claude 5h");
    expect(html).not.toContain("data-usage-meter");
  });

  it("has none in the left pane of the shell frame", () => {
    const left = host(renderToStaticMarkup(<ShellSplit threadTarget={target} />)).querySelector(
      "[data-pane='left']",
    );
    expect(left).not.toBeNull();
    expect(left?.textContent).not.toMatch(/5 h|Claude 5h/);
    expect(left?.querySelector("[data-usage-meter]")).toBeNull();
  });
});
