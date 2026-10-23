// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import { deriveLatestContextWindowSnapshot } from "../../lib/contextWindow";
import { ContextHandoffNudge } from "./ContextHandoffNudge";

const toast = vi.hoisted(() => ({ add: vi.fn((_options: unknown) => "nudge"), close: vi.fn() }));
vi.mock("../ui/toast", () => ({ toastManager: toast }));

it("reminds once per chat across dismissals and remounts, and explains missing size quietly", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  const container = document.createElement("div");
  const root = createRoot(container);
  const usage = (usedTokens: number, maxTokens?: number) =>
    deriveLatestContextWindowSnapshot([], {
      usedTokens,
      ...(maxTokens === undefined ? {} : { maxTokens }),
      updatedAt: "2026-10-14T00:00:00Z",
    });
  const render = (chatKey: string, usedTokens: number, maxTokens?: number) =>
    act(async () => {
      root.render(
        <ContextHandoffNudge
          key={chatKey}
          chatKey={chatKey}
          contextWindow={usage(usedTokens, maxTokens)}
        />,
      );
    });
  try {
    await render("claude", 44_999, 100_000);
    expect(toast.add).not.toHaveBeenCalled();
    await render("claude", 45_000, 100_000);
    expect(toast.add).toHaveBeenCalledTimes(1);
    const options = toast.add.mock.calls[0]?.[0] as unknown as {
      actionProps: { children: string; onClick: () => void };
    };
    expect(options.actionProps.children).toBe("Ask me later");
    options.actionProps.onClick();
    expect(toast.close).toHaveBeenCalledWith("nudge");
    await render("unknown", 90_000);
    expect(container.textContent).not.toContain("does not say how much memory a chat has");
    expect(toast.add).toHaveBeenCalledTimes(1);
    await render("claude", 80_000, 100_000);
    expect(toast.add).toHaveBeenCalledTimes(1);
    await render("codex", 50_000, 100_000);
    expect(toast.add).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
    vi.unstubAllGlobals();
  }
});
