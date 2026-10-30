// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { EMPTY_LIST, fixtureList } from "./content.fixtures";

vi.mock("@t3tools/client-runtime/state/runtime", () => ({
  createEnvironmentRpcQueryAtomFamily: () => () => null,
  createEnvironmentRpcCommand: () => ({}),
  squashAtomCommandFailure: () => null,
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

import { ContentScreen } from "./ContentView";

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

const render = async (props: Partial<Parameters<typeof ContentScreen>[0]> = {}) => {
  await act(async () =>
    root.render(
      <ContentScreen
        list={fixtureList()}
        error={null}
        canAct
        act={vi.fn(async () => "not used")}
        loadHistory={vi.fn(async () => null)}
        onRefresh={vi.fn()}
        {...props}
      />,
    ),
  );
};

const text = () => container.textContent ?? "";
const column = (label: string) =>
  container.querySelector<HTMLElement>(`section[aria-label="${label}"]`)!;

it("shows five stage groups with the videos of every deal", async () => {
  await render();
  const counts = ["Writing", "Needs review", "Ready to film", "Cut and revisions", "Delivered"].map(
    (label) => column(label).querySelectorAll("[data-video]").length,
  );
  expect(counts).toEqual([2, 1, 2, 1, 1]);
});

it("puts the approved video with the nearest due date in Film next", async () => {
  await render();
  const hero = container.querySelector<HTMLElement>('[aria-label="Film next"]')!;
  expect(hero.querySelector("h2")?.textContent).toBe("Desk at 2 AM, before and after");
  expect(hero.textContent).toContain("Lumen Lamp");
  expect(hero.textContent).toContain("Nov 2");
});

it("narrows the board and Film next to one deal", async () => {
  await render({ initialDeal: "acme-cases" });
  expect(column("Writing").querySelectorAll("[data-video]").length).toBe(1);
  const hero = container.querySelector<HTMLElement>('[aria-label="Film next"]')!;
  expect(hero.querySelector("h2")?.textContent).toBe("Drop test on the stairs");
  expect(container.querySelector('[aria-label="Deal"]')?.textContent).toBe("Acme Cases");
});

it("marks a video that breaks a brand rule", async () => {
  await render();
  const card = column("Writing").querySelector('[data-video="lumen-lamp/03-hype-reel"]');
  expect(card?.textContent).toContain("Rule break");
});

it("says when nothing is ready to film", async () => {
  const list = fixtureList();
  await render({
    list: {
      ...list,
      deals: list.deals.map((deal) => ({
        ...deal,
        videos: deal.videos.filter((v) => v.stage !== "ready_to_film"),
      })),
    },
  });
  expect(text()).toContain("Nothing is ready to film.");
});

it("explains the empty, no-workspace, loading and error states", async () => {
  await render({ list: EMPTY_LIST });
  expect(text()).toContain("No deals yet");
  await render({ list: null, noWorkspace: true });
  expect(text()).toContain("Connect your AIOS folder");
  await render({ list: null });
  expect(text()).toContain("Loading");
  await render({ list: null, error: "boom" });
  expect(text()).toContain("Content is not available now.");
});
