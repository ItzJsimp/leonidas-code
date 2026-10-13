import { ProviderDriverKind, type ProviderInstallState } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { resolveCommandPath, resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import {
  CLAUDE_FAILURES,
  asksForCode,
  classifyInstallerFailure,
  extractSignInUrl,
  installerCommand,
  installerPhaseForLine,
  isDefaultClaudeBinary,
  knownClaudeBinaries,
  parseAuthStatus,
  stripAnsi,
  trimDetails,
  type ClaudeInstallFailureKind,
} from "./ClaudeInstallation.logic.ts";

const DRIVER = ProviderDriverKind.make("claudeAgent");
const OUTPUT_TAIL_LIMIT = 8_192;

export class ClaudeInstallationError extends Schema.TaggedError<ClaudeInstallationError>()(
  "ClaudeInstallationError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message() {
    return this.detail;
  }
}

/** A setup step failed in a way the user can act on. Never leaves this module. */
class ClaudeSetupFailure extends Schema.TaggedError<ClaudeSetupFailure>()("ClaudeSetupFailure", {
  kind: Schema.String,
  details: Schema.NullOr(Schema.String),
}) {}

const isSetupFailure = Schema.is(ClaudeSetupFailure);
const fail = (kind: ClaudeInstallFailureKind, output = "") =>
  new ClaudeSetupFailure({ kind, details: trimDetails(output) });

/** What the router hands over per run: the instance's own binary setting and environment. */
export interface ClaudeStartInput {
  readonly binaryPath: string;
  readonly environment: NodeJS.ProcessEnv;
  /** Saves the discovered absolute path into the instance so no PATH lookup is needed. */
  readonly pinBinaryPath: (path: string) => Effect.Effect<void>;
}

interface ClaudeInstallationService {
  readonly start: (
    input: ClaudeStartInput,
  ) => Effect.Effect<ProviderInstallState, ClaudeInstallationError>;
  readonly cancel: (
    operationId: string,
  ) => Effect.Effect<ProviderInstallState, ClaudeInstallationError>;
  /** Writes the code the user pasted from the sign-in page to the CLI. */
  readonly submitCode: (
    operationId: string,
    code: string,
  ) => Effect.Effect<ProviderInstallState, ClaudeInstallationError>;
  readonly state: Effect.Effect<ProviderInstallState>;
  readonly changes: Stream.Stream<ProviderInstallState>;
  readonly remove: (
    protectedBinaryPaths?: ReadonlyArray<string>,
  ) => Effect.Effect<void, ClaudeInstallationError>;
}

export class ClaudeInstallation extends Context.Service<
  ClaudeInstallation,
  ClaudeInstallationService
>()("t3/provider/ClaudeInstallation") {
  static readonly layer = Layer.effect(ClaudeInstallation, makeClaudeInstallation());
}

export interface ClaudeInstallationOptions {
  /** How often sign-in is re-checked. */
  readonly pollInterval?: Duration.Input;
  /** How long to wait for the user to finish signing in. */
  readonly signInTimeout?: Duration.Input;
  readonly installTimeout?: Duration.Input;
}

const isRunning = (state: ProviderInstallState) =>
  ["checking", "downloading", "installing", "verifying", "signingIn"].includes(state.phase);

export function makeClaudeInstallation(options: ClaudeInstallationOptions = {}) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const crypto = yield* Crypto.Crypto;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const serviceScope = yield* Effect.scope;
    const platform = yield* HostProcess.Platform;
    const home = yield* HostProcess.HomeDirectory;
    const pollInterval = options.pollInterval ?? "2 seconds";
    const signInTimeout = options.signInTimeout ?? "10 minutes";
    const installTimeout = options.installTimeout ?? "10 minutes";
    const gate = yield* Semaphore.make(1);
    let running: { readonly operationId: string; readonly fiber: Fiber.Fiber<void> } | undefined;
    let writeCode: ((code: string) => Effect.Effect<void>) | undefined;

    const state = yield* SubscriptionRef.make<ProviderInstallState>({
      driver: DRIVER,
      operationId: null,
      phase: "idle",
      downloadedBytes: 0,
      totalBytes: null,
      version: null,
      installedVersion: null,
      executablePath: null,
      canRemove: false,
      message: null,
    });
    const patch = (next: Partial<ProviderInstallState>) =>
      SubscriptionRef.update(state, (current) => ({ ...current, ...next }));

    const spawn = Effect.fn("ClaudeInstallation.spawn")(function* (
      command: string,
      args: ReadonlyArray<string>,
      env: NodeJS.ProcessEnv,
    ) {
      const resolved = yield* resolveSpawnCommand(command, args, { env }).pipe(
        Effect.provideService(HostProcess.Platform, platform),
      );
      return yield* spawner.spawn(
        ChildProcess.make(resolved.command, resolved.args, { env, shell: resolved.shell }),
      );
    });

    /** Run a command to the end and return what it printed. */
    const collect = Effect.fn("ClaudeInstallation.collect")(
      function* (
        command: string,
        args: ReadonlyArray<string>,
        env: NodeJS.ProcessEnv,
        onLine?: (line: string) => Effect.Effect<void>,
      ) {
        const child = yield* spawn(command, args, env);
        let tail = "";
        const note = (chunk: string) => {
          tail = (tail + chunk).slice(-OUTPUT_TAIL_LIMIT);
        };
        const lines = <E>(stream: Stream.Stream<Uint8Array, E>) =>
          stream.pipe(
            Stream.decodeText(),
            Stream.tap((chunk) => Effect.sync(() => note(chunk))),
            Stream.splitLines,
            Stream.runForEach((line) => (onLine ? onLine(line) : Effect.void)),
          );
        const [, , exitCode] = yield* Effect.all(
          [lines(child.stdout), lines(child.stderr), child.exitCode],
          { concurrency: "unbounded" },
        );
        return { exitCode: Number(exitCode), output: tail };
      },
      Effect.scoped,
    );

    const findBinary = Effect.fn("ClaudeInstallation.findBinary")(function* (
      input: ClaudeStartInput,
    ) {
      const configured = input.binaryPath.trim();
      const candidates = isDefaultClaudeBinary(configured)
        ? knownClaudeBinaries(platform, home, path.join)
        : [configured];
      for (const candidate of candidates) {
        if (yield* fs.exists(candidate).pipe(Effect.orElseSucceed(() => false))) return candidate;
      }
      if (!isDefaultClaudeBinary(configured)) return null;
      return yield* resolveCommandPath("claude", { env: input.environment }).pipe(
        Effect.provideService(HostProcess.Platform, platform),
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.orElseSucceed(() => null),
      );
    });

    const authSignedIn = (executable: string, env: NodeJS.ProcessEnv) =>
      collect(executable, ["auth", "status"], env).pipe(
        Effect.map(({ exitCode, output }) => parseAuthStatus(output.trim(), exitCode)),
        Effect.timeout("20 seconds"),
        Effect.orElseSucceed(() => false),
      );

    const install = Effect.fn("ClaudeInstallation.install")(function* (input: ClaudeStartInput) {
      const command = installerCommand(platform);
      if (!command) return yield* fail("unsupported");
      yield* patch({ phase: "downloading", message: "Downloading Claude." });
      const result = yield* collect(command.command, command.args, input.environment, (line) => {
        const phase = installerPhaseForLine(line);
        return phase === "installing"
          ? patch({ phase: "installing", message: "Installing Claude." })
          : Effect.void;
      }).pipe(
        Effect.timeout(installTimeout),
        Effect.mapError((cause) =>
          Cause.isTimeoutError(cause) ? fail("network") : fail("installer", String(cause)),
        ),
      );
      if (result.exitCode !== 0) {
        return yield* fail(classifyInstallerFailure(result.output), result.output);
      }
    });

    const signIn = Effect.fn("ClaudeInstallation.signIn")(
      function* (operationId: string, executable: string, env: NodeJS.ProcessEnv) {
        yield* patch({
          phase: "signingIn",
          message: "Finish signing in to Claude in your browser.",
          signInUrl: null,
          awaitingCode: false,
        });
        const child = yield* spawn(executable, ["auth", "login"], env);
        const input = yield* Queue.unbounded<Uint8Array>();
        writeCode = (code) =>
          Queue.offer(input, new TextEncoder().encode(`${code}\n`)).pipe(Effect.asVoid);
        yield* Stream.fromQueue(input).pipe(
          Stream.run(child.stdin),
          Effect.ignore,
          Effect.forkScoped,
        );
        let seen = "";
        const read = <E>(stream: Stream.Stream<Uint8Array, E>) =>
          stream.pipe(
            Stream.decodeText(),
            Stream.runForEach((chunk) =>
              Effect.gen(function* () {
                seen = (seen + chunk).slice(-OUTPUT_TAIL_LIMIT);
                const url = extractSignInUrl(seen);
                const wantsCode = asksForCode(seen);
                const current = yield* SubscriptionRef.get(state);
                if (current.operationId !== operationId) return;
                if (url !== (current.signInUrl ?? null) || wantsCode !== current.awaitingCode) {
                  yield* patch({ signInUrl: url, awaitingCode: wantsCode });
                }
              }),
            ),
            Effect.ignore,
            Effect.forkScoped,
          );
        yield* read(child.stdout);
        yield* read(child.stderr);

        const poll = Effect.gen(function* () {
          while (true) {
            yield* Effect.sleep(pollInterval);
            if (yield* authSignedIn(executable, env)) return true;
          }
        });
        // The CLI exiting is only success when the account is really signed in.
        const exited = child.exitCode.pipe(
          Effect.flatMap(() => authSignedIn(executable, env)),
          Effect.orElseSucceed(() => false),
        );
        const signedIn = yield* Effect.raceFirst(poll, exited).pipe(
          Effect.timeoutOption(signInTimeout),
        );
        if (Option.isNone(signedIn)) return yield* fail("signInTimeout", seen);
        if (!signedIn.value) return yield* fail("signInFailed", seen);
      },
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => {
          writeCode = undefined;
        }),
      ),
    );

    const run = Effect.fn("ClaudeInstallation.run")(function* (
      operationId: string,
      input: ClaudeStartInput,
    ) {
      yield* patch({ phase: "checking", message: "Looking for Claude." });
      let executable = yield* findBinary(input);
      if (executable === null) {
        yield* install(input);
        yield* patch({ phase: "verifying", message: "Checking Claude." });
        executable = yield* findBinary(input);
        if (executable === null) return yield* fail("notFound");
      }
      yield* patch({ phase: "verifying", message: "Checking Claude." });
      const probe = yield* collect(executable, ["--version"], input.environment).pipe(
        Effect.timeout("20 seconds"),
        Effect.orElseSucceed(() => ({ exitCode: 1, output: "" })),
      );
      const version = /\d+\.\d+\.\d+/u.exec(stripAnsi(probe.output))?.[0];
      if (probe.exitCode !== 0 || !version) return yield* fail("verify", probe.output);
      if (isDefaultClaudeBinary(input.binaryPath)) yield* input.pinBinaryPath(executable);
      yield* patch({ installedVersion: version, executablePath: executable, source: "local" });
      if (!(yield* authSignedIn(executable, input.environment))) {
        yield* signIn(operationId, executable, input.environment);
      }
      yield* patch({
        phase: "succeeded",
        message: null,
        signInUrl: null,
        awaitingCode: false,
        recovery: null,
        details: null,
      });
    });

    const start = (input: ClaudeStartInput) =>
      gate
        .withPermit(
          Effect.gen(function* () {
            const current = yield* SubscriptionRef.get(state);
            if (isRunning(current)) return current;
            const operationId = yield* crypto.randomUUIDv4;
            const next: ProviderInstallState = {
              ...current,
              operationId,
              phase: "checking",
              message: "Looking for Claude.",
              signInUrl: null,
              awaitingCode: false,
              recovery: null,
              details: null,
            };
            yield* SubscriptionRef.set(state, next);
            const work = run(operationId, input).pipe(
              Effect.onExit((exit) =>
                Exit.isFailure(exit)
                  ? SubscriptionRef.update(state, (value) => {
                      if (value.operationId !== operationId || value.phase === "succeeded") {
                        return value;
                      }
                      if (Cause.hasInterruptsOnly(exit.cause)) {
                        return {
                          ...value,
                          phase: "cancelled",
                          message: "Setup cancelled.",
                          signInUrl: null,
                          awaitingCode: false,
                          recovery: "retry",
                        } satisfies ProviderInstallState;
                      }
                      const error = Cause.findErrorOption(exit.cause);
                      const failure =
                        Option.isSome(error) && isSetupFailure(error.value)
                          ? error.value
                          : null;
                      const copy =
                        CLAUDE_FAILURES[(failure?.kind as ClaudeInstallFailureKind) ?? "installer"] ??
                        CLAUDE_FAILURES.installer;
                      return {
                        ...value,
                        phase: "failed",
                        message: copy.message,
                        recovery: copy.recovery,
                        details: failure?.details ?? null,
                        signInUrl: null,
                        awaitingCode: false,
                      } satisfies ProviderInstallState;
                    })
                  : Effect.void,
              ),
              Effect.ignoreCause,
              Effect.ensuring(
                Effect.sync(() => {
                  if (running?.operationId === operationId) running = undefined;
                }),
              ),
            );
            const fiber = yield* Effect.forkIn(Effect.interruptible(work), serviceScope);
            running = { operationId, fiber };
            return next;
          }).pipe(Effect.uninterruptible),
        )
        .pipe(
          Effect.mapError(
            (cause) =>
              new ClaudeInstallationError({
                operation: "start",
                detail: "Couldn't start connecting Claude.",
                cause,
              }),
          ),
        );

    const stale = (operation: string) =>
      new ClaudeInstallationError({
        operation,
        detail: "This setup is no longer current. Try again.",
      });

    const cancel = Effect.fn("ClaudeInstallation.cancel")(function* (operationId: string) {
      return yield* gate.withPermit(
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          if (current.operationId !== operationId) return yield* stale("cancel");
          if (running?.operationId === operationId && isRunning(current)) {
            yield* Fiber.interrupt(running.fiber);
          }
          return yield* SubscriptionRef.get(state);
        }),
      );
    });

    const submitCode = Effect.fn("ClaudeInstallation.submitCode")(function* (
      operationId: string,
      code: string,
    ) {
      const current = yield* SubscriptionRef.get(state);
      if (current.operationId !== operationId || !writeCode) return yield* stale("submit-code");
      yield* writeCode(code);
      return current;
    });

    // Claude manages its own updates and uninstall; there is no managed folder to delete.
    const remove = () =>
      Effect.fail(
        new ClaudeInstallationError({
          operation: "remove",
          detail: "Claude is installed in your user folder and can't be removed from here.",
        }),
      );

    return ClaudeInstallation.of({
      start,
      cancel,
      submitCode,
      state: SubscriptionRef.get(state),
      changes: SubscriptionRef.changes(state),
      remove,
    });
  });
}
