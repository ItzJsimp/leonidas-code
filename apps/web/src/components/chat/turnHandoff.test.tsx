// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";
import * as DateTime from "effect/DateTime";
import { RunId } from "@t3tools/contracts";
import { countHandoffTurns, selectHandoffPrompt, useTurnHandoffBanner } from "./turnHandoff";

it("counts started user turns, excluding queued, rolled back and wake runs", () => {
  const date = DateTime.makeUnsafe("2026-10-15T00:00:00Z");
  expect(
    countHandoffTurns([
      { status: "completed", startedAt: date },
      { status: "running", startedAt: date },
      { status: "queued", startedAt: null },
      { status: "rolled_back", startedAt: date },
      { status: "completed", startedAt: date, workStartedAt: date },
      { status: "completed", startedAt: date, restartContinuationOfRunId: RunId.make("old") },
    ]),
  ).toBe(2);
});

it("uses the active saved handoff prompt and ignores archived or unrelated items", () => {
  expect(
    selectHandoffPrompt([
      { title: "Handoff now", body: "old", status: "archived" },
      { title: "Next", body: "next", status: "queued" },
      { title: "Handoff now", body: "saved handoff body", status: "queued" },
    ]),
  ).toBe("saved handoff body");
});

it("offers at turn 30, sends only on click and keeps dismissal across remounts", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  const host = document.createElement("div");
  const root = createRoot(host);
  const send = vi.fn(async () => true).mockResolvedValueOnce(false);
  function Fixture({ count, chatKey = "chat" }: { count: number; chatKey?: string }) {
    const banner = useTurnHandoffBanner({
      chatKey,
      turnCount: count,
      disabled: false,
      onHandoff: send,
    });
    return banner ? (
      <div>
        {banner.title}
        {banner.actions}
        <button onClick={banner.onDismiss}>Dismiss</button>
      </div>
    ) : null;
  }
  try {
    await act(async () => root.render(<Fixture count={29} />));
    expect(host.textContent).toBe("");
    await act(async () => root.render(<Fixture count={30} />));
    expect(host.textContent).toContain("30 turns");
    expect(send).not.toHaveBeenCalled();
    await act(async () => host.querySelector("button")!.click());
    expect(send).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("30 turns");
    await act(async () => host.querySelector("button")!.click());
    expect(send).toHaveBeenCalledTimes(2);
    expect(host.textContent).toBe("");
    await act(async () => root.render(<Fixture key="remount" count={31} />));
    expect(host.textContent).toBe("");
    await act(async () => root.render(<Fixture count={30} chatKey="other" />));
    expect(host.textContent).toContain("30 turns");
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
    vi.unstubAllGlobals();
  }
});
