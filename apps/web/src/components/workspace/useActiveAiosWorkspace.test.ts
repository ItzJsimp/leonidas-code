import { beforeEach, expect, it, vi } from "vite-plus/test";
import type { AiosWorkspaceSummary } from "@t3tools/contracts";

const state = vi.hoisted(() => ({
  data: null as { workspaces: ReadonlyArray<AiosWorkspaceSummary> } | null,
  error: null as string | null,
  setResolved: vi.fn(),
}));
vi.mock("react", () => ({
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => void) => fn(),
}));
vi.mock("~/state/environments", () => ({ usePrimaryEnvironmentId: () => "primary" }));
vi.mock("~/state/aiosWorkspaces", () => ({ aiosWorkspacesQuery: () => ({}) }));
vi.mock("~/state/query", () => ({
  useEnvironmentQuery: () => ({ data: state.data, error: state.error, refresh: vi.fn() }),
}));
vi.mock("./aiosWorkspaceStore", () => ({
  useAiosWorkspaceStore: (select: (store: unknown) => unknown) =>
    select({ chosen: { primary: "business" }, choose: vi.fn(), setResolved: state.setResolved }),
}));

import { useActiveAiosWorkspace } from "./useActiveAiosWorkspace";

beforeEach(() => {
  state.data = null;
  state.error = null;
  state.setResolved.mockClear();
});

it("blocks writes and preserves the chosen scope when workspace loading fails", () => {
  state.error = "Connection failed";
  const result = useActiveAiosWorkspace();
  expect(result.scopeReady).toBe(false);
  expect(result.scope).toEqual({ workspaceId: "business" });
  expect(state.setResolved).not.toHaveBeenCalled();
});

it("permits the default scope after a successful empty workspace list", () => {
  state.data = { workspaces: [] };
  expect(useActiveAiosWorkspace().scopeReady).toBe(true);
});
