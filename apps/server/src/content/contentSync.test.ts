// @effect-diagnostics nodeBuiltinImport:off - tests use real files and real Git in temp folders.
import { AuthFilesystemWriteScope, AuthMcpClientAccess, WS_METHODS } from "@t3tools/contracts";
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  cleanTemp,
  cloneOf,
  g,
  makeRemote,
  read,
  tempDir,
  write,
} from "../areaSync/engine/testRepos.ts";
import { mcpClientScopes } from "../auth/EnvironmentAuth.ts";
import { requiredScopeForRpcMethod } from "../auth/RpcAuthorization.ts";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ContentRpc from "./contentRpc.ts";

const keyLayer = Layer.mock(ServerSecretStore.ServerSecretStore)({
  getOrCreateRandom: () => Effect.succeed(new Uint8Array(32).fill(7)),
});

afterEach(cleanTemp);

const DEAL = '---\nbrand: "Acme Cases"\n---\n';
const VIDEO =
  '---\ntitle: "Drop test"\nstage: script_review\n---\n## Script\n\nSPOKEN: "Built to last."\n';

/** A shared remote, Gersi's clone of it, and Jake's clone. */
function pair() {
  const base = tempDir("content-sync-");
  const bare = makeRemote(base, "deals-repo", {
    "deals/acme-cases/deal.md": DEAL,
    "deals/acme-cases/01-drop-test.md": VIDEO,
  });
  const gersi = cloneOf(base, "deals-repo");
  const jake = cloneOf(base, "deals-repo");
  for (const clone of [gersi, jake]) {
    g(clone, "config", "user.name", "Test");
    g(clone, "config", "user.email", "test@example.invalid");
  }
  return { bare, gersi, jake };
}

const sync = (root: string) => ContentRpc.sync(Effect.succeed(root)).pipe(Effect.provide(keyLayer));
const push = (clone: string, file: string, text: string) => {
  write(clone, file, text);
  g(clone, "add", "-A");
  g(clone, "commit", "-m", `edit ${file}`);
  g(clone, "push");
};

describe("content sync", () => {
  it.effect(
    "sends a person's deal edits to the shared copy, and the other computer gets them",
    () =>
      Effect.gen(function* () {
        const { gersi, jake } = pair();
        write(
          gersi,
          "deals/acme-cases/01-drop-test.md",
          VIDEO.replace("Built to last.", "Built tough."),
        );
        write(gersi, "deals/new-deal/deal.md", '---\nbrand: "New"\n---\n');
        const sent = yield* sync(gersi);
        expect(sent).toMatchObject({ state: "pushed", committed: true, conflicts: [] });
        const got = yield* sync(jake);
        expect(got.state).toBe("pulled");
        expect(read(jake, "deals/acme-cases/01-drop-test.md")).toContain("Built tough.");
        expect(read(jake, "deals/new-deal/deal.md")).toContain("New");
        expect((yield* sync(jake)).state).toBe("synced");
      }),
  );

  it.effect("keeps both versions when two people edit the same line, and names the file", () =>
    Effect.gen(function* () {
      const { gersi, jake } = pair();
      push(
        jake,
        "deals/acme-cases/01-drop-test.md",
        VIDEO.replace("Built to last.", "Jake's line."),
      );
      write(
        gersi,
        "deals/acme-cases/01-drop-test.md",
        VIDEO.replace("Built to last.", "Gersi's line."),
      );
      const result = yield* sync(gersi);
      expect(result.state).toBe("conflict");
      expect(result.conflicts).toEqual(["deals/acme-cases/01-drop-test.md"]);
      // Gersi's text is still on his computer, and the tree is clean for the next try.
      expect(read(gersi, "deals/acme-cases/01-drop-test.md")).toContain("Gersi's line.");
      expect(g(gersi, "status", "--porcelain")).toBe("");
    }),
  );

  it.effect("refuses when files outside deals/ changed, and commits and pushes nothing", () =>
    Effect.gen(function* () {
      const { bare, gersi } = pair();
      const before = g(bare, "rev-parse", "main");
      write(
        gersi,
        "deals/acme-cases/01-drop-test.md",
        VIDEO.replace("Built to last.", "Built tough."),
      );
      write(gersi, "notes/private.md", "not for the shared copy\n");
      const error = yield* Effect.flip(sync(gersi));
      expect(error.message).toContain("notes/private.md");
      expect(g(bare, "rev-parse", "main")).toBe(before);
      expect(g(gersi, "log", "-1", "--format=%s")).toBe("seed");
      expect(NodeFS.existsSync(NodePath.join(gersi, "notes/private.md"))).toBe(true);
    }),
  );

  it.effect("says so when the folder is not a Git repo or no workspace is open", () =>
    Effect.gen(function* () {
      const plain = tempDir("content-sync-plain-");
      expect((yield* sync(plain)).state).toBe("error");
      const none = yield* Effect.flip(
        ContentRpc.sync(Effect.succeed(null)).pipe(Effect.provide(keyLayer)),
      );
      expect(none.message).toBe("No workspace is open.");
    }),
  );
});

describe("who can sync", () => {
  it("sync needs filesystem:write, which no agent access level holds", () => {
    expect(requiredScopeForRpcMethod(WS_METHODS.contentSync)).toBe(AuthFilesystemWriteScope);
    for (const access of AuthMcpClientAccess.literals) {
      expect(mcpClientScopes(access)).not.toContain(AuthFilesystemWriteScope);
    }
  });
});
