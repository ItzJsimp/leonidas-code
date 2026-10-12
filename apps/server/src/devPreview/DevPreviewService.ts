// @effect-diagnostics nodeBuiltinImport:off
import { DevPreviewError, type DevPreviewState, type Project } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const SCRIPT = NodePath.join("scripts", "dev-isolated.ps1");
const READY_POLL_MS = 1_000;
const READY_TIMEOUT_MS = 120_000;
// How long to wait for the sign-in link once the web server answers, before opening the plain address.
const PAIRING_GRACE_MS = 30_000;
const ANSI = /\u001b\[[0-9;]*m/g;

/** The dev server logs a one-time sign-in link; that link is what the preview opens. */
export function parsePairingUrl(line: string): string | null {
  return /pairingUrl[=:]\s*"?(https?:\/\/[^\s"]+)/i.exec(line.replace(ANSI, ""))?.[1] ?? null;
}

/** The dev runner prints its chosen web port on a `[dev-runner] ... webPort=N` line. */
export function parseWebPort(line: string): number | null {
  const port = /\bwebPort=(\d+)/.exec(line.replace(ANSI, ""))?.[1];
  return port === undefined ? null : Number(port);
}

interface Session {
  readonly child: NodeChildProcess.ChildProcess;
  state: DevPreviewState;
  webPort: number | null;
  webUpAt: number | null;
  pairingUrl: string | null;
  poll: ReturnType<typeof setInterval> | null;
}

const STOPPED: DevPreviewState = { status: "stopped", url: null, message: null, supported: true };

export class DevPreviewService extends Context.Service<
  DevPreviewService,
  {
    readonly status: (project: Project) => Effect.Effect<DevPreviewState>;
    readonly start: (project: Project) => Effect.Effect<DevPreviewState, DevPreviewError>;
    readonly stop: (project: Project) => Effect.Effect<DevPreviewState>;
  }
>()("leonidas/devPreview/DevPreviewService") {}

const isSupported = (project: Project) =>
  NodeFS.existsSync(NodePath.join(project.workspaceRoot, SCRIPT));

function killTree(child: NodeChildProcess.ChildProcess): void {
  // The pid was captured at spawn, so this can only ever hit our own child.
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    NodeChildProcess.spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

export const make = Effect.gen(function* () {
  const sessions = new Map<string, Session>();
  // A session removes itself on exit, so its last failure is parked here for status().
  const failedExits = new Map<string, DevPreviewState>();

  const stopSession = (root: string) => {
    const session = sessions.get(root);
    if (!session) return;
    sessions.delete(root);
    if (session.poll) clearInterval(session.poll);
    killTree(session.child);
  };

  yield* Effect.addFinalizer(() => Effect.sync(() => [...sessions.keys()].forEach(stopSession)));

  const status = (project: Project) =>
    Effect.sync(
      (): DevPreviewState =>
        sessions.get(project.workspaceRoot)?.state ?? {
          ...STOPPED,
          supported: isSupported(project),
        },
    );

  const start = (project: Project) =>
    Effect.gen(function* () {
      const root = project.workspaceRoot;
      const existing = sessions.get(root);
      if (existing) return existing.state;
      if (!isSupported(project)) {
        return yield* new DevPreviewError({ reason: "unsupported" });
      }
      failedExits.delete(root);
      return yield* Effect.try({
        try: () => {
          const child = NodeChildProcess.spawn(
            "pwsh",
            ["-NoProfile", "-File", SCRIPT, "-Mode", "web"],
            { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
          );
          const session: Session = {
            child,
            state: {
              status: "starting",
              url: null,
              message: "Starting preview copy…",
              supported: true,
            },
            webPort: null,
            webUpAt: null,
            pairingUrl: null,
            poll: null,
          };
          sessions.set(root, session);

          const fail = (message: string) => {
            if (sessions.get(root) !== session) return;
            if (session.poll) clearInterval(session.poll);
            session.state = { status: "failed", url: null, message, supported: true };
          };
          // Safe to call again: a late sign-in link replaces a plain address opened as the fallback.
          const markRunning = () => {
            if (session.poll) clearInterval(session.poll);
            session.poll = null;
            const url =
              session.pairingUrl ??
              (session.webPort === null ? null : `http://localhost:${String(session.webPort)}`);
            session.state = { status: "running", url, message: null, supported: true };
          };

          const onChunk = (chunk: Buffer) => {
            for (const line of chunk.toString("utf8").split(/\r?\n/)) {
              const text = line.replace(ANSI, "").trim();
              if (text.length === 0) continue;
              session.webPort ??= parseWebPort(text);
              const pairing = parsePairingUrl(text);
              if (pairing !== null) {
                session.pairingUrl = pairing;
                markRunning();
              } else if (session.state.status === "starting") {
                session.state = { ...session.state, message: text.slice(0, 200) };
              }
            }
          };
          child.stdout?.on("data", onChunk);
          child.stderr?.on("data", onChunk);
          child.on("error", (error) => fail(`Could not start: ${error.message}`));
          child.on("exit", (code) => {
            if (sessions.get(root) !== session) return;
            sessions.delete(root);
            if (session.poll) clearInterval(session.poll);
            if (session.state.status !== "stopped") {
              session.state = {
                status: code === 0 ? "stopped" : "failed",
                url: null,
                message: code === 0 ? null : `Preview copy exited with code ${String(code)}.`,
                supported: true,
              };
              // Keep the final state readable until the next start.
              failedExits.set(root, session.state);
            }
          });

          // The sign-in link is printed shortly after the web server answers. If it never shows,
          // fall back to the plain address so the copy is still reachable.
          const startedAt = Date.now();
          session.poll = setInterval(() => {
            if (Date.now() - startedAt > READY_TIMEOUT_MS)
              return fail("Preview copy took too long to start.");
            if (session.webPort === null) return;
            if (session.webUpAt !== null) {
              if (Date.now() - session.webUpAt > PAIRING_GRACE_MS) markRunning();
              return;
            }
            fetch(`http://localhost:${String(session.webPort)}/`, {
              signal: AbortSignal.timeout(READY_POLL_MS),
            }).then(
              () => {
                session.webUpAt ??= Date.now();
              },
              () => undefined,
            );
          }, READY_POLL_MS);

          return session.state;
        },
        catch: (cause) => new DevPreviewError({ reason: "spawn_failed", cause }),
      });
    });

  const stop = (project: Project) =>
    Effect.sync((): DevPreviewState => {
      stopSession(project.workspaceRoot);
      failedExits.delete(project.workspaceRoot);
      return { ...STOPPED, supported: isSupported(project) };
    });

  const statusWithFailure = (project: Project) =>
    Effect.flatMap(status(project), (state) =>
      Effect.succeed(
        state.status === "stopped" ? (failedExits.get(project.workspaceRoot) ?? state) : state,
      ),
    );

  return DevPreviewService.of({ status: statusWithFailure, start, stop });
});

export const layer = Layer.effect(DevPreviewService, make);
