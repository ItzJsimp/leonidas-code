// @effect-diagnostics nodeBuiltinImport:off - tests write real content files in temp Git repos.
import {
  AuthFilesystemWriteScope,
  AuthMcpClientAccess,
  AuthOrchestrationReadScope,
  clientRpcRequiredScopes,
  WS_METHODS,
} from "@t3tools/contracts";
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { cleanTemp, g, tempDir, write } from "../areaSync/engine/testRepos.ts";
import { mcpClientScopes } from "../auth/EnvironmentAuth.ts";
import { requiredScopeForRpcMethod } from "../auth/RpcAuthorization.ts";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ContentRpc from "./contentRpc.ts";

const keyLayer = Layer.mock(ServerSecretStore.ServerSecretStore)({
  getOrCreateRandom: () => Effect.succeed(new Uint8Array(32).fill(7)),
});

afterEach(cleanTemp);

/** A Git workspace whose user is "Gersi", with one video waiting in script review. */
function workspace(): string {
  const root = tempDir("content rpc-");
  g(root, "init", "-q", "-b", "main");
  g(root, "config", "user.name", "Gersi");
  g(root, "config", "user.email", "gersi@example.invalid");
  write(root, "deals/acme-cases/deal.md", '---\nbrand: "Acme Cases"\n---\n');
  write(
    root,
    "deals/acme-cases/01-drop-test.md",
    '---\ntitle: "Drop test"\nstage: script_review\n---\n## Script\n\nSPOKEN: "Built to last."\n',
  );
  g(root, "add", "-A");
  g(root, "commit", "-q", "-m", "seed");
  return root;
}

const ref = { deal: "acme-cases", file: "01-drop-test" } as const;

describe("content web actions", () => {
  it.effect("lists the deals of the workspace", () =>
    Effect.gen(function* () {
      const root = workspace();
      const list = yield* ContentRpc.list(Effect.succeed(root));
      expect(list.deals.map((deal) => deal.slug)).toEqual(["acme-cases"]);
      expect(list.bad).toEqual([]);
    }).pipe(Effect.provide(keyLayer)),
  );

  it.effect("a person approves under the workspace's Git name, and the commit goes in", () =>
    Effect.gen(function* () {
      const root = workspace();
      const result = yield* ContentRpc.move(Effect.succeed(root), { ...ref, to: "ready_to_film" });
      expect(result).toMatchObject({
        recorded: true,
        video: { stage: "ready_to_film", approval: "approved", approvedBy: "Gersi" },
      });
      expect(g(root, "log", "-1", "--format=%s")).toBe(
        "Content(Gersi): acme-cases/01-drop-test to ready_to_film",
      );
      const undone = yield* ContentRpc.move(Effect.succeed(root), { ...ref, to: "script_review" });
      expect(undone.video).toMatchObject({ stage: "script_review", approval: "none" });
    }).pipe(Effect.provide(keyLayer)),
  );

  it.effect("a person's script edit and the agent baseline history", () =>
    Effect.gen(function* () {
      const root = workspace();
      const saved = yield* ContentRpc.saveScript(Effect.succeed(root), {
        ...ref,
        script: 'SPOKEN: "Built tough."',
      });
      expect(saved).toMatchObject({ recorded: true, video: { script: 'SPOKEN: "Built tough."' } });
      const history = yield* ContentRpc.history(Effect.succeed(root), ref);
      expect(history).toEqual({ baseline: null, baselineCommit: null });
    }).pipe(Effect.provide(keyLayer)),
  );

  it.effect("a rule break comes back as a plain message", () =>
    Effect.gen(function* () {
      const root = workspace();
      const error = yield* Effect.flip(
        ContentRpc.move(Effect.succeed(root), { ...ref, to: "paid" }),
      );
      expect(error.message).toBe("A video cannot move from script_review to paid.");
    }).pipe(Effect.provide(keyLayer)),
  );

  it.effect("a missing workspace is a clear error", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(ContentRpc.list(Effect.succeed(null)));
      expect(error.message).toBe("No workspace is open.");
    }).pipe(Effect.provide(keyLayer)),
  );
});

describe("who can approve", () => {
  it("move and script edits need filesystem:write, which no agent access level holds", () => {
    for (const method of [WS_METHODS.contentMove, WS_METHODS.contentSaveScript]) {
      expect(requiredScopeForRpcMethod(method)).toBe(AuthFilesystemWriteScope);
      expect(clientRpcRequiredScopes(method, undefined)).toEqual([AuthFilesystemWriteScope]);
    }
    for (const access of AuthMcpClientAccess.literals) {
      expect(mcpClientScopes(access)).not.toContain(AuthFilesystemWriteScope);
    }
  });

  it("reads need only the read scope", () => {
    expect(requiredScopeForRpcMethod(WS_METHODS.contentList)).toBe(AuthOrchestrationReadScope);
    expect(requiredScopeForRpcMethod(WS_METHODS.contentHistory)).toBe(AuthOrchestrationReadScope);
  });
});
