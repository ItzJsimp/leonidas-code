// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { EMPTY_LIST, fixtureList, PROPOSAL } from "./content.fixtures";

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
        createDeal={vi.fn(async () => "not used")}
        decideDeal={vi.fn(async () => null)}
        sync={vi.fn(async () => "not used")}
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

describe("new deal", () => {
  const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
  const button = (name: string) =>
    [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);
  const type = async (label: string, value: string) => {
    const field = document.body.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[aria-label="${label}"]`,
    )!;
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("shows the button to a person, on the board and on the empty screen", async () => {
    await render();
    expect(button("New deal")).toBeDefined();
    await render({ list: EMPTY_LIST });
    expect(button("New deal")).toBeDefined();
    await render({ canAct: false });
    expect(button("New deal")).toBeUndefined();
  });

  it("starts a deal from the form, sends only the filled fields, and closes", async () => {
    const createDeal = vi.fn(async () => fixtureList().deals[0]!);
    const onRefresh = vi.fn();
    await render({ createDeal, onRefresh });
    await act(async () => button("New deal")!.click());
    expect(button("Start deal")?.hasAttribute("disabled")).toBe(true);
    await type("Brand", "Acme Cases");
    await type("Deadline", "2026-12-01");
    await act(async () => button("Start deal")!.click());
    expect(createDeal).toHaveBeenCalledWith({ brand: "Acme Cases", deadline: "2026-12-01" });
    expect(onRefresh).toHaveBeenCalled();
    expect(dialog()).toBeNull();
    expect(container.textContent).toContain("Started Acme Cases.");
  });

  it("keeps the form open with the server's words when the deal is refused", async () => {
    const createDeal = vi.fn(async () => "A deal for acme-cases already exists.");
    await render({ createDeal });
    await act(async () => button("New deal")!.click());
    await type("Brand", "Acme Cases");
    await act(async () => button("Start deal")!.click());
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      "A deal for acme-cases already exists.",
    );
    expect((document.body.querySelector('[aria-label="Brand"]') as HTMLInputElement).value).toBe(
      "Acme Cases",
    );
  });
});

describe("proposed deals", () => {
  const withProposal = (list = fixtureList()) => ({ ...list, proposals: [PROPOSAL] });
  const press = async (name: string) => {
    const target = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === name,
    );
    if (!target) throw new Error(`no button ${name}`);
    await act(async () => target.click());
  };
  const section = () => container.querySelector<HTMLElement>('[aria-label="Proposed deals"]');

  it("lists a proposal above the board with where it came from, and it is not on the board", async () => {
    await render({ list: withProposal() });
    expect(section()?.textContent).toContain("Lumen Lamp Two");
    expect(section()?.textContent).toContain("Email from Alex, Oct 28");
    expect(section()?.textContent).toContain("thread t1");
    expect(container.querySelector('[aria-label="Writing"] [data-deal="lumen-lamp-2"]')).toBeNull();
  });

  it("shows nothing when there is no proposal, and shows it on the empty screen too", async () => {
    await render();
    expect(section()).toBeNull();
    await render({ list: { ...EMPTY_LIST, proposals: [PROPOSAL] } });
    expect(section()?.textContent).toContain("Lumen Lamp Two");
  });

  it("gives Confirm and Dismiss to a person only", async () => {
    await render({ list: withProposal(), canAct: false });
    expect(section()?.textContent).toContain("Lumen Lamp Two");
    expect(section()?.querySelectorAll("button").length).toBe(0);
  });

  it("confirms with one tap, refreshes and says so", async () => {
    const decideDeal = vi.fn(async () => null);
    const onRefresh = vi.fn();
    await render({ list: withProposal(), decideDeal, onRefresh });
    await press("Confirm");
    expect(decideDeal).toHaveBeenCalledWith("lumen-lamp-2", "confirm");
    expect(onRefresh).toHaveBeenCalled();
    expect(container.textContent).toContain("Started Lumen Lamp Two.");
  });

  it("dismisses, and shows a refusal in the server's words", async () => {
    const decideDeal = vi.fn(async () => "A deal for lumen-lamp-2 already exists.");
    await render({ list: withProposal(), decideDeal });
    await press("Dismiss");
    expect(decideDeal).toHaveBeenCalledWith("lumen-lamp-2", "dismiss");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "A deal for lumen-lamp-2 already exists.",
    );
  });
});

describe("sync", () => {
  const syncButton = () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith("Sync"));
  const done = (state: string, extra: object = {}) => ({
    state,
    detail: "",
    conflicts: [] as string[],
    committed: false,
    ...extra,
  });

  it("shows Sync to a person only", async () => {
    await render();
    expect(syncButton()).toBeDefined();
    await render({ canAct: false });
    expect(syncButton()).toBeUndefined();
  });

  it("syncs, refreshes the board and says what happened in plain words", async () => {
    const sync = vi.fn(async () => done("pulled") as never);
    const onRefresh = vi.fn();
    await render({ sync, onRefresh });
    await act(async () => syncButton()!.click());
    expect(sync).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Got new changes from the shared copy.",
    );
  });

  it("names the files when both people changed the same lines", async () => {
    const sync = vi.fn(
      async () => done("conflict", { conflicts: ["deals/acme-cases/01-drop-test.md"] }) as never,
    );
    await render({ sync });
    await act(async () => syncButton()!.click());
    const alert = container.querySelector('[role="alert"]')?.textContent ?? "";
    expect(alert).toContain("deals/acme-cases/01-drop-test.md");
    expect(alert).toContain("Both versions are kept.");
  });

  it("shows the server's words when Sync did not run, and a plain line when offline", async () => {
    await render({ sync: vi.fn(async () => "Other files changed, so Sync did not run: a.md.") });
    await act(async () => syncButton()!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Other files changed, so Sync did not run: a.md.",
    );
    await render({ sync: vi.fn(async () => done("offline") as never) });
    await act(async () => syncButton()!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("You are offline.");
  });
});
