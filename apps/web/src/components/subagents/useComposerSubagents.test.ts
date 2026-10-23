import { beforeEach, expect, it, vi } from "vite-plus/test";
import type { ComposerThreadTarget } from "~/composerDraftStore";

const state = vi.hoisted(() => ({
  requests: [] as Array<{ environmentId: string; input: { workspaceId?: string } }>,
  loaded: true,
  thread: { environmentId: "remote", projectId: "business-project" } as {
    environmentId: string;
    projectId: string;
  } | null,
  draft: null as { environmentId: string; projectId: string } | null,
}));
vi.mock("react", () => ({ useMemo: (fn: () => unknown) => fn() }));
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({}) }));
vi.mock("../twoState/shownChatContext", () => ({ useRouteOrShownThreadRef: () => null }));
vi.mock("~/state/environments", () => ({ usePrimaryEnvironmentId: () => "primary" }));
vi.mock("~/state/entities", () => ({ useThreadShell: () => state.thread }));
vi.mock("~/composerDraftStore", () => ({
  useComposerDraftStore: (select: (s: unknown) => unknown) =>
    select({ getDraftSession: () => state.draft, getDraftSessionByRef: () => state.draft }),
}));
vi.mock("../workspace/aiosWorkspaceStore", () => ({
  useAiosWorkspaceStore: (select: (s: unknown) => unknown) =>
    select({ chosen: { primary: "personal", remote: "personal" } }),
}));
vi.mock("~/state/aiosWorkspaces", () => ({
  aiosWorkspacesQuery: (args: unknown) => ({ tag: "workspaces", args }),
}));
vi.mock("~/state/subagents", () => ({
  subagentsComposerQuery: (args: unknown) => ({ tag: "helpers", args }),
}));
vi.mock("~/state/query", () => ({
  useEnvironmentQuery: (
    query: { tag: string; args: { environmentId: string; input: { workspaceId?: string } } } | null,
  ) => {
    if (!query || !state.loaded) return { data: null, error: null };
    if (query.tag === "helpers") {
      state.requests.push(query.args);
      return { data: { entries: [] } };
    }
    return {
      data: {
        workspaces: [
          { id: "personal", status: "ready", isDefault: true, projectIds: ["personal-project"] },
          { id: "business", status: "ready", isDefault: false, projectIds: ["business-project"] },
        ],
      },
    };
  },
}));

import { useComposerSubagents } from "./useComposerSubagents";

beforeEach(() => {
  state.requests = [];
  state.loaded = true;
  state.thread = { environmentId: "remote", projectId: "business-project" };
  state.draft = null;
});

it("sends the thread's environment and workspace instead of the window's selection", () => {
  useComposerSubagents({ environmentId: "remote", threadId: "thread" } as ComposerThreadTarget);
  expect(state.requests).toEqual([{ environmentId: "remote", input: { workspaceId: "business" } }]);
});

it("scopes unsent drafts and waits for workspace and thread data", () => {
  state.thread = null;
  useComposerSubagents("draft" as ComposerThreadTarget);
  expect(state.requests).toEqual([]);
  state.draft = { environmentId: "primary", projectId: "business-project" };
  state.loaded = false;
  useComposerSubagents("draft" as ComposerThreadTarget);
  expect(state.requests).toEqual([]);
  state.loaded = true;
  useComposerSubagents("draft" as ComposerThreadTarget);
  expect(state.requests).toEqual([
    { environmentId: "primary", input: { workspaceId: "business" } },
  ]);
});
