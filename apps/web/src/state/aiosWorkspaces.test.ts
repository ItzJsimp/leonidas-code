import { expect, it, vi } from "vite-plus/test";
import { Atom, AtomRegistry } from "effect/reactivity";
import { EnvironmentId } from "@t3tools/contracts";

const captured = vi.hoisted(() => ({
  trigger: undefined as
    | ((target: { environmentId: EnvironmentId }) => Atom.Atom<unknown>)
    | undefined,
}));
vi.mock("../connection/runtime", () => ({ connectionAtomRuntime: {} }));
vi.mock("@t3tools/client-runtime/state/runtime", () => ({
  createEnvironmentRpcCommand: () => ({}),
  createEnvironmentRpcQueryAtomFamily: (
    _runtime: unknown,
    options: { refreshTrigger: typeof captured.trigger },
  ) => {
    captured.trigger = options.refreshTrigger;
    return {};
  },
}));
vi.mock("./projects", async () => {
  const { Atom } = await import("effect/reactivity");
  return {
    environmentProjects: {
      environmentProjectsAtom: Atom.family(() =>
        Atom.make<ReadonlyArray<{ id: string; workspaceRoot: string; title?: string }>>([]),
      ),
    },
  };
});

import { environmentProjects } from "./projects";
import "./aiosWorkspaces";

it("refreshes workspace discovery when a project is added or moved, but not renamed", () => {
  const registry = AtomRegistry.make();
  try {
    const environmentId = EnvironmentId.make("environment");
    const projects = environmentProjects.environmentProjectsAtom(environmentId);
    const trigger = captured.trigger!({ environmentId });
    const empty = registry.get(trigger);
    // The mock source is writable; production reads the same shape from its shell projection.
    const source = projects as unknown as Atom.Writable<
      ReadonlyArray<{ id: string; workspaceRoot: string; title?: string }>
    >;
    registry.set(source, [{ id: "business", workspaceRoot: "/business" }]);
    const added = registry.get(trigger);
    expect(added).not.toBe(empty);
    registry.set(source, [{ id: "business", workspaceRoot: "/business", title: "Renamed" }]);
    expect(registry.get(trigger)).toBe(added);
    registry.set(source, [{ id: "business", workspaceRoot: "/moved" }]);
    expect(registry.get(trigger)).not.toBe(added);
  } finally {
    registry.dispose();
  }
});
