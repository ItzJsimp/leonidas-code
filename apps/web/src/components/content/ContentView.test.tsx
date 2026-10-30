// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

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

describe("video panel", () => {
  const card = (ref: string) => container.querySelector<HTMLElement>(`[data-video="${ref}"]`)!;
  const press = async (name: string) => {
    const target = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === name,
    );
    if (!target) throw new Error(`no button ${name}`);
    await act(async () => target.click());
  };
  const panel = () => container.querySelector<HTMLElement>('[aria-label="Video"]');

  it("opens a video with its script, scorecard and stage actions", async () => {
    await render();
    await act(async () => card("acme-cases/02-pocket-check-with-keys").click());
    expect(panel()?.querySelector("h2")?.textContent).toBe("Pocket check with keys");
    expect(panel()?.textContent).toContain("Three floors. Not one crack.");
    expect(panel()?.textContent).toContain("Hook score 8/10");
    await act(async () =>
      container.querySelector<HTMLElement>('button[aria-label="Close"]')!.click(),
    );
    expect(panel()).toBeNull();
  });

  it("approves, then undo puts the video back in review", async () => {
    const actFn = vi.fn(async () => fixtureList().deals[0]!.videos[1]!);
    await render({ act: actFn });
    await act(async () => card("acme-cases/02-pocket-check-with-keys").click());
    await press("Approve script");
    expect(actFn).toHaveBeenLastCalledWith({
      kind: "move",
      deal: "acme-cases",
      file: "02-pocket-check-with-keys",
      to: "ready_to_film",
    });
    expect(container.textContent).toContain("Approved.");
    await press("Undo");
    expect(actFn).toHaveBeenLastCalledWith({
      kind: "move",
      deal: "acme-cases",
      file: "02-pocket-check-with-keys",
      to: "script_review",
    });
  });

  it("sends a script back with a note", async () => {
    const actFn = vi.fn(async () => fixtureList().deals[0]!.videos[1]!);
    await render({ act: actFn });
    await act(async () => card("acme-cases/02-pocket-check-with-keys").click());
    await press("Request changes");
    const note = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="What to change"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        note,
        "Shorter hook.",
      );
      note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await press("Send back");
    expect(actFn).toHaveBeenLastCalledWith({
      kind: "move",
      deal: "acme-cases",
      file: "02-pocket-check-with-keys",
      to: "scripting",
      note: "Shorter hook.",
    });
  });

  it("marks the Film next video filmed, and undo restores it", async () => {
    const actFn = vi.fn(async () => fixtureList().deals[1]!.videos[0]!);
    await render({ act: actFn });
    await press("Mark filmed");
    expect(actFn).toHaveBeenLastCalledWith(expect.objectContaining({ to: "filmed" }));
    await press("Undo");
    expect(actFn).toHaveBeenLastCalledWith(expect.objectContaining({ to: "ready_to_film" }));
  });

  it("shows a refusal in plain words", async () => {
    await render({ act: vi.fn(async () => "Only a person approves a script.") });
    await act(async () => card("acme-cases/02-pocket-check-with-keys").click());
    await press("Approve script");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Only a person approves a script.",
    );
  });

  it("reader mode shows the spoken lines in big text", async () => {
    await render();
    await act(async () => card("acme-cases/01-drop-test-on-the-stairs").click());
    await press("Reader mode");
    const reader = container.querySelector<HTMLElement>('[data-reader="true"]');
    expect(reader?.className).toContain("text-2xl");
  });
});
