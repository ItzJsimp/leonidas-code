// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import type { DecideFn } from "./BatchApproval";
import { EMPTY_LIST, fixtureList } from "./marketing.fixtures";

vi.mock("@t3tools/client-runtime/state/runtime", () => ({
  createEnvironmentRpcQueryAtomFamily: () => () => null,
  createEnvironmentRpcCommand: () => ({}),
}));
vi.mock("../../connection/runtime", () => ({ connectionAtomRuntime: {} }));
vi.mock("../../state/environments", () => ({ usePrimaryEnvironmentId: () => "env-1" }));
vi.mock("../../state/session", () => ({ useEnvironmentScope: () => true }));
vi.mock("../../state/query", () => ({
  useEnvironmentQuery: () => ({ data: null, error: null, refresh: () => {} }),
}));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: unknown }) => (
    <a href={to}>{children as never}</a>
  ),
}));

import { MarketingScreen } from "./MarketingView";

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

const render = async (props: Partial<Parameters<typeof MarketingScreen>[0]> = {}) => {
  const decide = vi.fn<DecideFn>(async (decisions) =>
    decisions.map((d) => ({ ticketId: d.ticketId, ok: true })),
  );
  const onRefresh = vi.fn();
  await act(async () =>
    root.render(
      <MarketingScreen
        list={fixtureList(3, 2)}
        error={null}
        canDecide
        decide={decide}
        onRefresh={onRefresh}
        {...props}
      />,
    ),
  );
  return { decide, onRefresh };
};

const click = async (el: Element | null | undefined) => {
  await act(async () => (el as HTMLElement).click());
};
const button = (name: RegExp) =>
  [...container.querySelectorAll("button")].find((b) => name.test(b.textContent ?? ""));
const boxes = () => [...container.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];

it("approve sends one decision per selected item, each with its own ticket id", async () => {
  const list = fixtureList(3, 0);
  const { decide, onRefresh } = await render({ list });
  // boxes()[0] is "select all"; then one per item (grouped by brand, so read the labels).
  await click(boxes()[0]);
  await click(button(/^Approve \(3\)/));
  expect(decide).toHaveBeenCalledTimes(1);
  const sent = decide.mock.calls[0]![0];
  expect(sent.map((d) => d.decision)).toEqual(["approve", "approve", "approve"]);
  expect(new Set(sent.map((d) => d.ticketId))).toEqual(new Set(list.queue.map((q) => q.ticket.id)));
  expect(container.textContent).toContain("3 items done.");
  expect(onRefresh).toHaveBeenCalled();
});

it("reject sends reject for only the selected item", async () => {
  const list = fixtureList(3, 0);
  const { decide } = await render({ list });
  await click(boxes()[1]);
  await click(button(/^Reject \(1\)/));
  const sent = decide.mock.calls[0]![0];
  expect(sent).toHaveLength(1);
  expect(sent[0]!.decision).toBe("reject");
});

it("shows each failure and keeps the rest done", async () => {
  const list = fixtureList(2, 0);
  const decide = vi.fn<DecideFn>(async (decisions) => [
    { ticketId: decisions[0]!.ticketId, ok: true },
    { ticketId: decisions[1]!.ticketId, ok: false, reason: "content_changed" },
  ]);
  await render({ list, decide });
  await click(boxes()[0]);
  await click(button(/^Approve \(2\)/));
  expect(container.textContent).toContain("1 done, 1 not done.");
  expect(container.textContent).toContain("The text changed after the request. Ask again.");
});

it("shows an error and keeps the selection when the call fails", async () => {
  const decide = vi.fn<DecideFn>(async () => null);
  await render({ decide });
  await click(boxes()[0]);
  await click(button(/^Approve/));
  expect(container.querySelector("[role=alert]")?.textContent).toContain("Nothing changed");
});

it("shows the same error when the call throws", async () => {
  const decide = vi.fn<DecideFn>(async () => {
    throw new Error("socket closed");
  });
  await render({ decide });
  await click(boxes()[0]);
  await click(button(/^Approve/));
  expect(container.querySelector("[role=alert]")?.textContent).toContain("Nothing changed");
  expect((button(/^Approve/) as HTMLButtonElement).disabled).toBe(false);
});

it("cannot decide without the permission, and says why", async () => {
  const { decide } = await render({ canDecide: false });
  await click(boxes()[0]);
  const approve = button(/^Approve/) as HTMLButtonElement;
  expect(approve.disabled).toBe(true);
  await click(approve);
  expect(decide).not.toHaveBeenCalled();
  expect(container.textContent).toContain("This session can only look.");
});

it("lists drafts and posted items with their numbers", async () => {
  await render();
  await click(container.querySelector("#marketing-tab-content"));
  expect(container.textContent).toContain("Posted");
  expect(container.textContent).toContain("Draft");
  expect(container.textContent).toContain("500 seen");
});

it("shows totals on the Metrics tab", async () => {
  await render();
  await click(container.querySelector("#marketing-tab-metrics"));
  expect(container.textContent).toContain("Posts tracked");
  expect(container.textContent).toContain("1K");
});

it("moves between tabs with the arrow keys", async () => {
  await render();
  const first = container.querySelector("#marketing-tab-approval") as HTMLElement;
  await act(async () =>
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
  );
  expect(container.querySelector("#marketing-tab-content")?.getAttribute("aria-selected")).toBe(
    "true",
  );
});

it("renders the empty state and a 200 item queue without a crash", async () => {
  await render({ list: EMPTY_LIST });
  expect(container.textContent).toContain("Nothing waits for you.");
  await render({ list: fixtureList(200, 0) });
  expect(container.querySelectorAll("li")).toHaveLength(200);
  expect(container.textContent).toContain("Select all (200)");
});

it("shows when the list was last updated", async () => {
  await render({ updatedAt: new Date(2026, 9, 22, 19, 45).getTime() });
  expect(container.textContent).toContain("Updated 7:45 PM.");
  expect(container.querySelectorAll("[role=tab]")).toHaveLength(5);
});

it("is called Content and has Email and Ads tabs that say they are coming", async () => {
  await render({ list: null, noWorkspace: true });
  expect(container.querySelector("h1")?.textContent).toBe("Content");
  await click(container.querySelector("#marketing-tab-email"));
  expect(container.textContent).toContain("Email drafts are coming.");
  await click(container.querySelector("#marketing-tab-ads"));
  expect(container.textContent).toContain("Ad drafts are coming.");
});

it("shows brand names, not slugs", async () => {
  await render();
  expect(container.textContent).toContain("Acme Games");
  expect(container.textContent).not.toContain("acme-games");
});

it("asks for an AIOS folder when none is connected", async () => {
  await render({ list: null, noWorkspace: true, error: "No workspace is open." });
  expect(container.textContent).toContain("Connect your AIOS folder");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/tasks");
});

it("says when the queue and the content list are cut", async () => {
  const list = { ...fixtureList(3, 2), queueTotal: 340, postsTotal: 900 };
  await render({ list });
  expect(container.textContent).toContain("Showing the oldest 3 of 340.");
  await click(container.querySelector("#marketing-tab-content"));
  expect(container.textContent).toContain("Showing the newest 5 of 900.");
});

it("never shows the words MCP, worktree or T3", async () => {
  await render();
  expect(container.textContent).not.toMatch(/\bMCP\b|worktree|\bT3\b/i);
});
