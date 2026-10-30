// @effect-diagnostics nodeBuiltinImport:off - tests write real content files in temp Git repos.
import { AuthFilesystemWriteScope, AuthMcpClientAccess, WS_METHODS } from "@t3tools/contracts";
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { cleanTemp, g, tempDir, write } from "../areaSync/engine/testRepos.ts";
import { mcpClientScopes } from "../auth/EnvironmentAuth.ts";
import { requiredScopeForRpcMethod } from "../auth/RpcAuthorization.ts";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ContentRpc from "./contentRpc.ts";

afterEach(cleanTemp);

/** One computer's secret store, kept in memory. Each computer makes its own approval key. */
function computer(seed: number) {
  const secrets = new Map<string, Uint8Array>([
    ["content-approval-key", new Uint8Array(32).fill(seed)],
  ]);
  return Layer.mock(ServerSecretStore.ServerSecretStore)({
    get: (name) => Effect.succeed(Option.fromNullishOr(secrets.get(name))),
    set: (name, value) => Effect.sync(() => void secrets.set(name, value)),
    getOrCreateRandom: (name) => Effect.sync(() => secrets.get(name)!),
  });
}
const computers = () => ({ jake: computer(7), gersi: computer(9) });

function workspace(): string {
  const root = tempDir("content pair-");
  g(root, "init", "-q", "-b", "main");
  g(root, "config", "user.name", "Jake");
  g(root, "config", "user.email", "jake@example.invalid");
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

const approvalOn = (layer: Layer.Layer<ServerSecretStore.ServerSecretStore>, root: string) =>
  ContentRpc.list(Effect.succeed(root)).pipe(
    Effect.provide(layer),
    Effect.map((list) => list.deals[0]!.videos[0]!.approval),
  );

describe("pairing two computers", () => {
  it.effect("an approval made on one computer verifies on the other only after pairing", () =>
    Effect.gen(function* () {
      const root = workspace();
      const { jake, gersi } = computers();
      yield* ContentRpc.move(Effect.succeed(root), {
        deal: "acme-cases",
        file: "01-drop-test",
        to: "ready_to_film",
      }).pipe(Effect.provide(jake));
      expect(yield* approvalOn(jake, root)).toBe("approved");
      expect(yield* approvalOn(gersi, root)).toBe("unsigned");

      const code = yield* ContentRpc.pairingStart().pipe(Effect.provide(jake));
      const paired = yield* ContentRpc.pairingAccept({ blob: code.blob, pin: code.pin }).pipe(
        Effect.provide(gersi),
      );
      expect(paired.replacedKey).toBe(true);
      expect(yield* approvalOn(gersi, root)).toBe("approved");
    }),
  );

  it.effect("a wrong PIN changes nothing, and a code works once", () =>
    Effect.gen(function* () {
      const root = workspace();
      const { jake, gersi } = computers();
      yield* ContentRpc.move(Effect.succeed(root), {
        deal: "acme-cases",
        file: "01-drop-test",
        to: "ready_to_film",
      }).pipe(Effect.provide(jake));
      const code = yield* ContentRpc.pairingStart().pipe(Effect.provide(jake));
      const wrong = yield* Effect.flip(
        ContentRpc.pairingAccept({ blob: code.blob, pin: "0000-0000" }).pipe(Effect.provide(gersi)),
      );
      expect(wrong.message).toBe("That code does not match.");
      expect(yield* approvalOn(gersi, root)).toBe("unsigned");

      yield* ContentRpc.pairingAccept(code).pipe(Effect.provide(gersi));
      const again = yield* Effect.flip(
        ContentRpc.pairingAccept(code).pipe(Effect.provide(computer(3))),
      );
      expect(again.message).toBe("That code was used already.");
    }),
  );

  it("making and accepting a code need filesystem:write, which no agent access level holds", () => {
    for (const method of [WS_METHODS.contentPairingStart, WS_METHODS.contentPairingAccept]) {
      expect(requiredScopeForRpcMethod(method)).toBe(AuthFilesystemWriteScope);
    }
    for (const access of AuthMcpClientAccess.literals) {
      expect(mcpClientScopes(access)).not.toContain(AuthFilesystemWriteScope);
    }
  });
});
