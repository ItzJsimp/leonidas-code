// @effect-diagnostics nodeBuiltinImport:off globalDate:off globalDateInEffect:off globalTimersInEffect:off globalFetch:off - Supervises a child dev process with plain timers and a localhost probe, outside the orchestration runtime.
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

/** A plain dev server prints its address as `http://localhost:PORT`, in any of its loopback spellings. */
export function parseLocalUrl(line: string): number | null {
  const port = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d+)/i.exec(
    line.replace(ANSI, ""),
  )?.[1];
  return port === undefined ? null : Number(port);
}

export interface GenericDevServer {
  readonly command: string;
  /** The port the script names or its framework defaults to; null when unknown. */
  readonly port: number | null;
}

const FRAMEWORK_PORTS: ReadonlyArray<readonly [string, number]> = [
  ["vite", 5173],
  ["next", 3000],
  ["astro", 4321],
  ["ng serve", 4200],
  ["react-scripts", 3000],
];

/** Finds how an ordinary project starts its dev server: its `dev` (else `start`) package script. */
function detectDevServer(root: string): GenericDevServer | null {
  let scripts: Record<string, unknown> | undefined;
  try {
    scripts = JSON.parse(NodeFS.readFileSync(NodePath.join(root, "package.json"), "utf8")).scripts;
  } catch {
    return null;
  }
  const name = typeof scripts?.dev === "string" ? "dev" : "start";
  const body = scripts?.[name];
  if (typeof body !== "string") return null;
  const has = (file: string) => NodeFS.existsSync(NodePath.join(root, file));
  const manager = has("pnpm-lock.yaml")
    ? "pnpm"
    : has("yarn.lock")
      ? "yarn"
      : has("bun.lock") || has("bun.lockb")
        ? "bun"
        : "npm";
  const named = /(?:--port[ =]|-p |PORT=)(\d{2,5})/.exec(body)?.[1];
  const port =
    named === undefined
      ? (FRAMEWORK_PORTS.find(([needle]) => body.includes(needle))?.[1] ?? null)
      : Number(named);
  return { command: `${manager} run ${name}`, port };
}

const answers = (port: number) =>
  fetch(`http://localhost:${String(port)}/`, { signal: AbortSignal.timeout(500) }).then(
    () => true,
    () => false,
  );

interface Session {
  readonly child: NodeChildProcess.ChildProcess;
  /** Set for a plain dev server, which has no sign-in link to wait for. */
  readonly generic: GenericDevServer | null;
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
>()("t3/devPreview/DevPreviewService") {}

const hasIsolatedScript = (project: Project) =>
  NodeFS.existsSync(NodePath.join(project.workspaceRoot, SCRIPT));

const isSupported = (project: Project) =>
  hasIsolatedScript(project) || detectDevServer(project.workspaceRoot) !== null;

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

const make = Effect.gen(function* () {
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

  // The state of a generic project whose server is not ours: already answering on its port, or idle.
  const idleState = (project: Project) =>
    Effect.promise(async (): Promise<DevPreviewState> => {
      const generic = hasIsolatedScript(project) ? null : detectDevServer(project.workspaceRoot);
      const command = generic?.command ?? null;
      if (generic?.port != null && (await answers(generic.port))) {
        const url = `http://localhost:${String(generic.port)}`;
        return { status: "running", url, message: null, supported: true, command };
      }
      return { ...STOPPED, supported: generic !== null || isSupported(project), command };
    });

  const status = (project: Project) => {
    const session = sessions.get(project.workspaceRoot);
    return session ? Effect.succeed(session.state) : idleState(project);
  };

  const start = (project: Project) =>
    Effect.gen(function* () {
      const root = project.workspaceRoot;
      const existing = sessions.get(root);
      if (existing) return existing.state;
      if (!isSupported(project)) {
        return yield* new DevPreviewError({ reason: "unsupported" });
      }
      const generic = hasIsolatedScript(project) ? null : detectDevServer(root);
      if (generic !== null) {
        // Something already serves the project's port: preview that instead of starting a second copy.
        const idle = yield* idleState(project);
        if (idle.status === "running") return idle;
      }
      failedExits.delete(root);
      return yield* Effect.try({
        try: () => {
          const child =
            generic === null
              ? NodeChildProcess.spawn("pwsh", ["-NoProfile", "-File", SCRIPT, "-Mode", "web"], {
                  cwd: root,
                  windowsHide: true,
                  stdio: ["ignore", "pipe", "pipe"],
                })
              : // The command is built from a fixed manager name and script name, never user text.
                NodeChildProcess.spawn(generic.command, {
                  cwd: root,
                  shell: true,
                  windowsHide: true,
                  stdio: ["ignore", "pipe", "pipe"],
                });
          const session: Session = {
            child,
            generic,
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

          // The last printed line explains a non-zero exit in the failure message.
          let lastLine: string | null = null;
          const onChunk = (chunk: Buffer) => {
            for (const line of chunk.toString("utf8").split(/\r?\n/)) {
              const text = line.replace(ANSI, "").trim();
              if (text.length === 0) continue;
              lastLine = text;
              session.webPort ??= generic === null ? parseWebPort(text) : parseLocalUrl(text);
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
                message:
                  code === 0
                    ? null
                    : `Preview copy exited with code ${String(code)}${lastLine ? `: ${lastLine.slice(0, 200)}` : "."}`,
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
            // A server that never prints its address is tried on the port its script implies.
            if (session.webPort === null && generic?.port != null && Date.now() - startedAt > 8_000)
              session.webPort = generic.port;
            if (session.webPort === null) return;
            if (session.webUpAt !== null) {
              if (generic !== null) return markRunning();
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
