import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vite-plus/test";

import { EMPTY_LIST, fixtureList } from "./marketing.fixtures";

const query = vi.hoisted(() => ({ data: null as unknown, error: null as string | null }));

vi.mock("@t3tools/client-runtime/state/runtime", () => ({
  createEnvironmentRpcQueryAtomFamily: () => () => null,
  createEnvironmentRpcCommand: () => ({}),
}));
vi.mock("../../connection/runtime", () => ({ connectionAtomRuntime: {} }));
vi.mock("../../state/environments", () => ({ usePrimaryEnvironmentId: () => "env-1" }));
vi.mock("../../state/session", () => ({ useEnvironmentScope: () => true }));
vi.mock("../../state/query", () => ({
  useEnvironmentQuery: () => ({ data: query.data, error: query.error, refresh: () => {} }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: unknown }) => (
    <a href={to}>{children as never}</a>
  ),
}));

import { NeedsApprovalCard } from "./NeedsApprovalCard";
import { slots } from "./marketing.slot";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

beforeEach(() => {
  query.data = null;
  query.error = null;
});

it("shows the count and the first three items of the queue", () => {
  query.data = fixtureList(5, 0);
  const html = renderToStaticMarkup(<NeedsApprovalCard />);
  expect(text(html)).toContain("Marketing: needs approval 5");
  expect(html.match(/<li /g)).toHaveLength(3);
  expect(text(html)).toContain("Open Marketing (2 more)");
  expect(html).toContain('href="/marketing"');
});

it("says nothing waits when the queue is empty", () => {
  query.data = { ...fixtureList(0, 2) };
  const html = renderToStaticMarkup(<NeedsApprovalCard />);
  expect(text(html)).toContain("Nothing waits for you.");
});

it("renders nothing for a workspace with no marketing files", () => {
  query.data = EMPTY_LIST;
  expect(renderToStaticMarkup(<NeedsApprovalCard />)).toBe("");
});

it("renders nothing when the read failed, so the home page stays quiet", () => {
  query.error = "No workspace is open.";
  expect(renderToStaticMarkup(<NeedsApprovalCard />)).toBe("");
});

it("registers a home card and a header stat", () => {
  expect(slots.ccHome?.map((entry) => entry.id)).toEqual(["marketing-needs-approval"]);
  expect(slots.headerStat?.[0]?.label).toBe("Needs approval");
});

it("never shows the words MCP, worktree or T3", () => {
  query.data = fixtureList(2, 1);
  expect(text(renderToStaticMarkup(<NeedsApprovalCard />))).not.toMatch(/\bMCP\b|worktree|\bT3\b/i);
});
