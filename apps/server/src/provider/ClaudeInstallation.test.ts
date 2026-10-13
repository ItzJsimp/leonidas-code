import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import type { ProviderInstallState } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Crypto from "effect/Crypto";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type * as Scope from "effect/Scope";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/process";

import { makeClaudeInstallation, type ClaudeStartInput } from "./ClaudeInstallation.ts";

const text = (value: string) => Stream.encodeText(Stream.make(value));

interface Scenario {
  readonly installed: boolean;
  readonly signedIn: boolean;
  readonly installerOutput?: { stdout?: string; stderr?: string; exit: number };
  readonly loginOutput?: string;
  readonly signInTimeout?: Duration.Input;
}

/** Stand-ins for the installer, `claude --version`, `auth status` and `auth login`. */
const makeHarness = Effect.fn("ClaudeInstallation.test.makeHarness")(function* (
  scenario: Scenario,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const platform = yield* HostProcess.Platform;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-install-" });
  const binary = path.join(home, ".local", "bin", platform === "win32" ? "claude.exe" : "claude");
  const installBinary = Effect.gen(function* () {
    yield* fs.makeDirectory(path.dirname(binary), { recursive: true });
    yield* fs.writeFileString(binary, "x");
    yield* fs.chmod(binary, 0o755);
  }).pipe(Effect.orDie);
  if (scenario.installed) yield* installBinary;

  const ran: string[] = [];
  const stdin: string[] = [];
  let signedIn = scenario.signedIn;
  const handle = (options: {
    stdout?: string;
    stderr?: string;
    exit?: number;
    hang?: boolean;
    stdinSink?: Sink.Sink<void, Uint8Array>;
  }) =>
    ChildProcessSpawner.makeHandle({
      pid: ChildProcessSpawner.ProcessId(1),
      exitCode: options.hang
        ? Effect.never
        : Effect.succeed(ChildProcessSpawner.ExitCode(options.exit ?? 0)),
      isRunning: Effect.succeed(false),
      kill: () => Effect.void,
      unref: Effect.succeed(Effect.void),
      stdin: options.stdinSink ?? Sink.drain,
      stdout: text(options.stdout ?? ""),
      stderr: text(options.stderr ?? ""),
      all: Stream.empty,
      getInputFd: () => Sink.drain,
      getOutputFd: () => Stream.empty,
    });
  const spawner = ChildProcessSpawner.make((command) =>
    Effect.gen(function* () {
      if (command._tag !== "StandardCommand") return handle({});
      const args = command.args.join(" ");
      if (command.command === binary) {
        ran.push(`claude ${args}`);
        if (args === "--version") return handle({ stdout: "2.1.0 (Claude Code)" });
        if (args === "auth status") {
          return handle({
            stdout: JSON.stringify({ loggedIn: signedIn }),
            exit: signedIn ? 0 : 1,
          });
        }
        // auth login: print the sign-in page, then wait for the user.
        return handle({
          stdout: scenario.loginOutput ?? "",
          hang: true,
          stdinSink: Sink.forEach((chunk: Uint8Array) =>
            Effect.sync(() => {
              stdin.push(new TextDecoder().decode(chunk));
              signedIn = true;
            }),
          ),
        });
      }
      ran.push("installer");
      yield* installBinary;
      return handle(scenario.installerOutput ?? { stdout: "Installing Claude Code...", exit: 0 });
    }).pipe(Effect.orDie),
  );
  const pinned: string[] = [];
  const input: ClaudeStartInput = {
    binaryPath: "claude",
    environment: {},
    pinBinaryPath: (value) => Effect.sync(() => void pinned.push(value)),
  };
  const service = yield* makeClaudeInstallation({
    pollInterval: "10 millis",
    signInTimeout: scenario.signInTimeout ?? "10 seconds",
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Layer.succeed(HostProcess.HomeDirectory, home),
      ),
    ),
  );
  const waitFor = (predicate: (state: ProviderInstallState) => boolean) =>
    service.changes.pipe(Stream.filter(predicate), Stream.runHead, Effect.timeout("10 seconds"));
  return { service, input, ran, stdin, pinned, waitFor, binary };
});

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path | Crypto.Crypto | Scope.Scope>) =>
  effect.pipe(Effect.scoped, Effect.provide(NodeServices.layer));

describe("ClaudeInstallation", () => {
  it.live("skips the installer and sign-in when Claude is ready", () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness({ installed: true, signedIn: true });
        yield* h.service.start(h.input);
        yield* h.waitFor((state) => state.phase === "succeeded");
        assert.notInclude(h.ran, "installer");
        assert.deepEqual(h.pinned, [h.binary]);
        const state = yield* h.service.state;
        assert.equal(state.installedVersion, "2.1.0");
        assert.equal(state.executablePath, h.binary);
      }),
    ),
  );

  it.live("installs, finds the binary and signs in through the coarse phases", () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness({
          installed: false,
          signedIn: false,
          loginOutput: "Visit https://claude.ai/oauth/authorize?x=1 to sign in\nPaste code here > ",
        });
        const phases: string[] = [];
        yield* h.service.changes.pipe(
          Stream.runForEach((state) => Effect.sync(() => void phases.push(state.phase))),
          Effect.forkScoped,
        );
        const started = yield* h.service.start(h.input);
        yield* h.waitFor((state) => state.awaitingCode === true);
        const mid = yield* h.service.state;
        assert.equal(mid.signInUrl, "https://claude.ai/oauth/authorize?x=1");
        assert.equal(mid.phase, "signingIn");
        yield* h.service.submitCode(started.operationId ?? "", "abc-123");
        yield* h.waitFor((state) => state.phase === "succeeded");
        assert.deepEqual(h.stdin, ["abc-123\n"]);
        assert.deepEqual(h.pinned, [h.binary]);
        for (const phase of ["checking", "installing", "verifying", "signingIn", "succeeded"]) {
          assert.include(phases, phase);
        }
      }),
    ),
  );

  it.live("turns a network failure into one sentence with a retry", () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness({
          installed: false,
          signedIn: false,
          installerOutput: { stderr: "irm : Unable to connect to the remote server", exit: 1 },
        });
        yield* h.service.start(h.input);
        yield* h.waitFor((state) => state.phase === "failed");
        const state = yield* h.service.state;
        assert.equal(state.message, "Couldn't download Claude. Check your internet connection.");
        assert.equal(state.recovery, "retry");
        assert.include(state.details ?? "", "Unable to connect");
      }),
    ),
  );

  it.live("times out an unfinished sign-in with a sign-in recovery", () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness({
          installed: true,
          signedIn: false,
          loginOutput: "https://claude.ai/oauth/authorize?x=1",
          signInTimeout: "50 millis",
        });
        yield* h.service.start(h.input);
        yield* h.waitFor((state) => state.phase === "failed");
        const state = yield* h.service.state;
        assert.equal(state.message, "Sign-in didn't finish in time.");
        assert.equal(state.recovery, "signIn");
        assert.equal(state.signInUrl, null);
      }),
    ),
  );

  it.live("rejects a code for an operation that is not current", () =>
    run(
      Effect.gen(function* () {
        const h = yield* makeHarness({ installed: true, signedIn: true });
        const error = yield* Effect.flip(h.service.submitCode("nope", "abc"));
        assert.equal(error.operation, "submit-code");
      }),
    ),
  );
});
