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
        { slug: "one", name: "Project One", projectId: "one", repository: "team/one", open: 1 },
        { slug: "two", name: "Project Two", projectId: null, repository: null, open: 1 },
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
  await renderBadge(null);
});

async function renderBadge(activeProjectId: string | null, cwd: string | null = null) {
  await act(() =>
    root.render(
      <ComposerNextActionBadge
        alignRight={false}
        environmentId={EnvironmentId.make("env")}
        activeProjectId={activeProjectId}
        cwd={cwd}
        onFill={fill}
      />,
    ),
  );
}

const prepareButton = () =>
  [...document.querySelectorAll("button")].find((item) => item.textContent === "Write message")!;

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  state.workspace.mockClear();
  state.shared.mockClear();
  vi.unstubAllGlobals();
});

async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === label || item.firstElementChild?.textContent === label,
  )!;
  expect(button).toBeDefined();
  await act(() => button.click());
}

it("loads only when opened, selects a project, and fills without sending", async () => {
  expect(state.workspace).not.toHaveBeenCalled();
  await click("Start task");
  await click("Project One");
  expect(state.shared).toHaveBeenLastCalledWith("env", [{ slug: "one", projectId: "one" }]);
  await click("Write message");
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
    (item) => item.textContent === "Write message",
  )!;
  expect(prepare.disabled).toBe(true);
  expect(fill).not.toHaveBeenCalled();
});

it("waits for the selected shared board before preparing", async () => {
  state.shared.mockReturnValue({ tasks: [], error: null, isPending: true, refresh: vi.fn() });
  await click("Start task");
  await click("Project One");
  const prepare = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === "Write message",
  )!;
  expect(prepare.disabled).toBe(true);
  expect(document.querySelector('[role="status"]')?.textContent).toBe("Loading tasks...");
});

it("explains empty projects and does not create a prompt", async () => {
  state.workspace.mockReturnValue({
    data: {
      projects: [
        { slug: "empty", name: "Empty project", projectId: null, repository: null, open: 0 },
      ],
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
  expect(document.body.textContent).toContain("This project has no open tasks");
  const prepare = [...document.querySelectorAll("button")].find(
    (item) => item.textContent === "Write message",
  )!;
  expect(prepare.disabled).toBe(true);
  expect(fill).not.toHaveBeenCalled();
});

it("selects the project for the current chat without a click", async () => {
  await renderBadge("one");
  await click("Start task");
  expect(document.body.textContent).toContain("This chat");
  expect(prepareButton().disabled).toBe(false);
  await click("Write message");
  expect(fill.mock.calls[0]![0]).toContain("local-one");
  expect(fill.mock.calls[0]![0]).not.toContain("other-project");
});

it("detects the project from the working directory and lets the user change it", async () => {
  await renderBadge(null, "D:/Work Space/projects/two/src");
  await click("Start task");
  await click("Project One");
  await click("Write message");
  expect(fill.mock.calls[0]![0]).toContain("local-one");
});

it("does not prepare a prompt for a project with only closed tasks", async () => {
  state.workspace.mockReturnValue({
    data: {
      projects: [{ slug: "one", name: "Project One", projectId: "one", repository: null, open: 0 }],
      tasks: [{ ...task("finished", "one"), status: "done" }],
    },
    isSuccess: true,
    isPending: false,
    error: null,
    refresh: vi.fn(),
  });
  state.shared.mockReturnValue({ tasks: [], error: null, isPending: false, refresh: vi.fn() });
  await renderBadge("one");
  await click("Start task");
  expect(document.body.textContent).toContain("This project has no open tasks");
  expect(prepareButton().disabled).toBe(true);
});
