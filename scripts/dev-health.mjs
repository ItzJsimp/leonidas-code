#!/usr/bin/env node
// Dev copy health check and watchdog (Windows). Finds this checkout's Vite web
// server and backend, probes both with a timeout, and says which one is down.
//   node scripts/dev-health.mjs            check once
//   node scripts/dev-health.mjs --fix --server <port>   restart a frozen Vite (only the PID that owns its web port)
//   node scripts/dev-health.mjs --watch --server <port>   check every 30 s and fix; log evidence to .t3/dev-health.log
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, openSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logFile = join(repoRoot, ".t3", "dev-health.log");
const PROBE_TIMEOUT_MS = 5_000;
const args = new Set(process.argv.slice(2));

function ps(script) {
  return execFileSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    timeout: 20_000,
  }).trim();
}

/** Listening node processes started from this checkout: [{ pid, port, cmd }]. */
function findListeners() {
  const out = ps(
    `Get-NetTCPConnection -State Listen | ForEach-Object { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"; if ($p -and $p.Name -eq 'node.exe') { "$($_.OwningProcess)|$($_.LocalPort)|$($p.CommandLine)" } }`,
  );
  const root = repoRoot.toLowerCase();
  return out
    .split(/\r?\n/)
    .map((line) => line.split("|"))
    .filter((parts) => parts.length >= 3)
    .map(([pid, port, ...cmd]) => ({ pid: Number(pid), port: Number(port), cmd: cmd.join("|") }))
    .filter((entry) => entry.cmd.toLowerCase().includes(root) || /src[\/]bin.ts/.test(entry.cmd));
}

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return { ok: res.status < 500, status: res.status, ms: Date.now() - started };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    return { ok: false, status: timedOut ? "timeout" : "refused", ms: Date.now() - started };
  }
}

function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${stamped}\n`);
}

/** Facts that help explain a freeze later: CPU, memory, stuck sockets. */
function evidence(pid, port) {
  try {
    const proc = ps(
      `$p = Get-Process -Id ${pid}; "cpu=$([int]$p.CPU)s ws=$([int]($p.WS/1MB))MB handles=$($p.HandleCount) threads=$($p.Threads.Count) up=$([int]((Get-Date) - $p.StartTime).TotalMinutes)min"`,
    );
    const stuck = ps(
      `(Get-NetTCPConnection -LocalPort ${port} -State CloseWait -ErrorAction SilentlyContinue | Measure-Object).Count`,
    );
    return `${proc} close_wait=${stuck}`;
  } catch {
    return "evidence unavailable";
  }
}

async function check({ fix }) {
  const listeners = findListeners();
  // Several dev stacks can share one checkout (one per agent session), so check every Vite.
  const webs = listeners.filter(
    (entry) => /vite/i.test(entry.cmd) && entry.cmd.toLowerCase().includes(repoRoot.toLowerCase()),
  );
  const backends = listeners.filter((entry) => !webs.includes(entry));
  const serverArg = args.has("--server")
    ? Number(process.argv[process.argv.indexOf("--server") + 1])
    : null;
  let healthy = true;

  log(`found ${webs.length} Vite and ${backends.length} backend listener(s) for this checkout`);
  for (const server of backends) {
    const result = await probe(`http://127.0.0.1:${server.port}/api/auth/session`);
    if (result.status === "refused" || (result.ok && result.status !== 200)) continue; // not a T3 backend
    log(`server :${server.port} pid=${server.pid} -> ${result.status} ${result.ms}ms`);
    if (!result.ok) {
      healthy = false;
      log(`SERVER UNHEALTHY :${server.port} ${evidence(server.pid, server.port)}`);
    }
  }
  if (webs.length === 0) {
    log("WEB DOWN: no Vite is listening. Run the dev runner.");
    return false;
  }

  for (const web of webs) {
    const result = await probe(`http://localhost:${web.port}/`);
    log(`web :${web.port} pid=${web.pid} -> ${result.status} ${result.ms}ms`);
    if (result.ok) continue;
    healthy = false;
    log(`WEB FROZEN :${web.port} ${evidence(web.pid, web.port)}`);
    if (!fix) continue;
    if (!serverArg) {
      log(
        `  cannot restart :${web.port}: pass --server <backend port> so the new Vite proxies to the right backend`,
      );
      continue;
    }
    // Only the PID that owns this web port and runs from this checkout.
    execFileSync("taskkill", ["/PID", String(web.pid), "/T", "/F"], { stdio: "ignore" });
    mkdirSync(join(repoRoot, ".t3"), { recursive: true });
    const out = openSync(join(repoRoot, ".t3", "vite-dev.log"), "a");
    const child = spawn(join(repoRoot, "node_modules", ".bin", "vp.cmd"), ["dev"], {
      cwd: join(repoRoot, "apps", "web"),
      env: { ...process.env, PORT: String(web.port), T3CODE_PORT: String(serverArg) },
      detached: true,
      stdio: ["ignore", out, out],
      shell: true,
    });
    child.unref();
    log(`WEB RESTARTED :${web.port} new pid=${child.pid} (old pid ${web.pid} stopped)`);
  }
  return healthy;
}

if (args.has("--watch")) {
  for (;;) {
    await check({ fix: args.has("--server") });
    await new Promise((resolveWait) => setTimeout(resolveWait, 30_000));
  }
} else {
  process.exitCode = (await check({ fix: args.has("--fix") })) ? 0 : 1;
}
