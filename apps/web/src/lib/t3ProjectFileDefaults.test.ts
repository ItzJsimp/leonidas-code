import { EnvironmentId, type ProjectReadFileResult } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const projectQueries = vi.hoisted(() => ({ readFile: vi.fn(), optimisticFile: vi.fn() }));

vi.mock("~/state/projects", () => ({ projectEnvironment: projectQueries }));

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { readT3ProjectFile } from "./t3ProjectFileDefaults";

const environmentId = EnvironmentId.make("test-environment");

function file(contents: string): ProjectReadFileResult {
  return { relativePath: "t3.json", contents, byteLength: contents.length, truncated: false };
}

afterEach(() => {
  appAtomRegistry.reset();
  vi.clearAllMocks();
});

describe("readT3ProjectFile", () => {
  it("returns cached defaults without waiting for an in-flight refresh", async () => {
    const query = Atom.make(
      AsyncResult.success(file('{"defaultThreadEnvMode":"worktree"}'), { waiting: true }),
    );
    projectQueries.readFile.mockReturnValue(query);
    projectQueries.optimisticFile.mockReturnValue(Atom.make(null));

    // The refresh stays pending: opening a chat must not depend on its completion.
    const result = await Promise.race([
      readT3ProjectFile(environmentId, "/repo"),
      Promise.resolve().then(() => "still waiting"),
    ]);

    expect(result).toMatchObject({ defaultThreadEnvMode: "worktree" });
  });

  it("waits for the first read so a cold chat preserves project defaults", async () => {
    const query = Atom.make<AsyncResult.AsyncResult<ProjectReadFileResult>>(AsyncResult.initial());
    projectQueries.readFile.mockReturnValue(query);
    projectQueries.optimisticFile.mockReturnValue(Atom.make(null));

    const pending = readT3ProjectFile(environmentId, "/repo");
    expect(await Promise.race([pending, Promise.resolve("still waiting")])).toBe("still waiting");
    appAtomRegistry.set(query, AsyncResult.success(file('{"defaultThreadEnvMode":"worktree"}')));

    expect(await pending).toMatchObject({ defaultThreadEnvMode: "worktree" });
  });

  it("uses in-app edits immediately while the server read is pending", async () => {
    projectQueries.readFile.mockReturnValue(
      Atom.make(AsyncResult.initial<ProjectReadFileResult>()),
    );
    projectQueries.optimisticFile.mockReturnValue(
      Atom.make({ data: file('{"defaultThreadEnvMode":"local"}') }),
    );

    expect(await readT3ProjectFile(environmentId, "/repo")).toMatchObject({
      defaultThreadEnvMode: "local",
    });
  });

  it.each([
    ["invalid", file("{invalid")],
    ["truncated", { ...file('{"defaultThreadEnvMode":"worktree"}'), truncated: true }],
  ])("ignores %s cached files without blocking on a refresh", async (_, data) => {
    projectQueries.readFile.mockReturnValue(
      Atom.make(AsyncResult.success(data, { waiting: true })),
    );
    projectQueries.optimisticFile.mockReturnValue(Atom.make(null));

    expect(await readT3ProjectFile(environmentId, "/repo")).toBeNull();
  });
});
