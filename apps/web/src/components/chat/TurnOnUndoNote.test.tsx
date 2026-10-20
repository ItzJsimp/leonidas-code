// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ isRepo: false, run: vi.fn() }));
vi.mock("~/state/query", () => ({
  useEnvironmentQuery: () => ({ data: { isRepo: mocks.isRepo } }),
}));
vi.mock("~/state/vcs", () => ({ vcsEnvironment: { status: () => "status" } }));
vi.mock("~/state/sourceControlActions", () => ({
  useVcsInitAction: () => ({ isPending: false, run: mocks.run }),
}));
import { TURN_ON_UNDO_TEXT, TurnOnUndoNote } from "./TurnOnUndoNote";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.isRepo = false;
  mocks.run.mockReset().mockResolvedValue({ _tag: "Success" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = () =>
  act(async () =>
    root.render(<TurnOnUndoNote environmentId={EnvironmentId.make("env-1")} cwd="C:/x" />),
  );

it("offers to turn on saved history in a folder without git, and confirms after the click", async () => {
  await render();
  expect(container.textContent).toContain(TURN_ON_UNDO_TEXT);
  await act(async () => container.querySelector("button")!.click());
  expect(mocks.run).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Saved history is on");
});

it("shows nothing when the folder already has git", async () => {
  mocks.isRepo = true;
  await render();
  expect(container.textContent).toBe("");
});

it("says so when git init fails", async () => {
  mocks.run.mockResolvedValue({ _tag: "Failure" });
  await render();
  await act(async () => container.querySelector("button")!.click());
  expect(container.textContent).toContain("That did not work");
});
