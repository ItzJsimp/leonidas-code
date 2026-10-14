// @vitest-environment jsdom
import { EnvironmentId, type TaskBoardTask } from "@t3tools/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { ComposerNextActionBadge } from "./ComposerNextActionBadge";

const state = vi.hoisted(() => ({
  workspace: vi.fn(),
  shared: vi.fn(),
}));
vi.mock("~/state/query", () => ({ useEnvironmentQuery: state.workspace }));
vi.mock("~/state/taskBoard", () => ({ taskBoardWorkspaceQuery: (input: unknown) => input }));
vi.mock("../taskBoard/useSharedBoards", () => ({ useSharedBoards: state.shared }));

let root: Root;
let host: HTMLDivElement;
const fill = vi.fn();

function task(id: string, slug: string): TaskBoardTask {
  return {
    id,
    title: id,
    project: slug,
    projectSlug: slug,
    description: "Details",
    status: "todo",
    priority: "high",
    source: "board",
  } as TaskBoardTask;
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.workspace.mockReturnValue({
    data: {
      projects: [
        { slug: "one", name: "Project One", projectId: "one", repository: "team/one" },
        { slug: "two", name: "Project Two", projectId: null, repository: null },
      ],
      tasks: [task("local-one", "one"), task("other-project", "two")],
    },
    isSuccess: true,
    isPending: false,
    error: null,
    refresh: vi.fn(),
  });
  state.shared.mockReturnValue({
    tasks: [task("shared-one", "one")],
    error: null,
    isPending: false,
    refresh: vi.fn(),
  });
  fill.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() =>
    root.render(
      <ComposerNextActionBadge
        alignRight={false}
        environmentId={EnvironmentId.make("env")}
        onFill={fill}
      />,
    ),
  );
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  state.workspace.mockClear();
  state.shared.mockClear();
  vi.unstubAllGlobals();
});

async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  )!;
  expect(button).toBeDefined();
  await act(() => button.click());
}

it("loads only when opened, selects a project, and fills without sending", async () => {
  expect(state.workspace).not.toHaveBeenCalled();
  await click("Start task");
  await click("Project One");
  expect(state.shared).toHaveBeenLastCalledWith("env", [{ slug: "one", projectId: "one" }]);
  await click("Prepare prompt");
  expect(fill).toHaveBeenCalledTimes(1);
  expect(fill.mock.calls[0]![0]).toContain("local-one");
  expect(fill.mock.calls[0]![0]).toContain("shared-one");
  expect(fill.mock.calls[0]![0]).not.toContain("other-project");
  expect(fill.mock.calls[0]![0]).toContain("prompt-composer");
});

it("keeps preparation disabled when a board fails", async () => {
  state.shared.mockReturnValue({
    tasks: [],
    error: "Board unavailable",
    isPending: false,
    refresh: vi.fn(),
  });
  await click("Start task");
  await click("Project One");
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Board unavailable");
  const prepare = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === "Prepare prompt",
  )!;
  expect(prepare.disabled).toBe(true);
  expect(fill).not.toHaveBeenCalled();
});

it("waits for the selected shared board before preparing", async () => {
  state.shared.mockReturnValue({ tasks: [], error: null, isPending: true, refresh: vi.fn() });
  await click("Start task");
  await click("Project One");
  const prepare = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === "Prepare prompt",
  )!;
  expect(prepare.disabled).toBe(true);
  expect(document.querySelector('[role="status"]')?.textContent).toBe("Loading tasks...");
});

it("explains empty projects and does not create a prompt", async () => {
  state.workspace.mockReturnValue({
    data: {
      projects: [{ slug: "empty", name: "Empty project", projectId: null, repository: null }],
      tasks: [],
    },
    isSuccess: true,
    isPending: false,
    error: null,
    refresh: vi.fn(),
  });
  state.shared.mockReturnValue({ tasks: [], error: null, isPending: false, refresh: vi.fn() });
  await click("Start task");
  await click("Empty project");
  expect(document.body.textContent).toContain("This project has no tasks");
  const prepare = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === "Prepare prompt",
  )!;
  expect(prepare.disabled).toBe(true);
  expect(fill).not.toHaveBeenCalled();
});
