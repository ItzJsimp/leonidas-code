// @effect-diagnostics globalDate:off globalTimers:off - synchronous node and global APIs are used on purpose in this file.
// @effect-diagnostics nodeBuiltinImport:off
// Kills a real child process by its captured PID at each crash point and checks what survives.
// Set CRASH_PROOF_SOURCE_DB to a state.sqlite path to run against a temp COPY of that database
// (the file and its -wal are copied; the source is never opened).
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeSqlite from "node:sqlite";

import { afterEach, describe, expect, it } from "vite-plus/test";

const WORKER = NodePath.join(import.meta.dirname, "crashWorker.ts");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

function makeDir(): string {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "crash-durability-"));
  tempDirs.push(dir);
  return dir;
}

function seedDatabase(dir: string): number {
  const source = process.env.CRASH_PROOF_SOURCE_DB;
  if (source) {
    for (const suffix of ["", "-wal"]) {
      if (NodeFS.existsSync(source + suffix)) {
        NodeFS.copyFileSync(source + suffix, NodePath.join(dir, `state.sqlite${suffix}`));
      }
    }
  }
  const db = new NodeSqlite.DatabaseSync(NodePath.join(dir, "state.sqlite"));
  db.exec("CREATE TABLE IF NOT EXISTS crash_seed_threads (id TEXT PRIMARY KEY, title TEXT)");
  db.exec("INSERT OR REPLACE INTO crash_seed_threads VALUES ('t1', 'My thread')");
  const row = db.prepare("SELECT count(*) AS n FROM crash_seed_threads").get() as { n: number };
  db.close();
  return row.n;
}

/** Spawns the worker, waits until `ready` accepts a stdout line, then kills that PID. */
async function runAndKill(
  mode: string,
  dir: string,
  ready: (lines: string[]) => boolean,
): Promise<string[]> {
  const child = NodeChildProcess.spawn(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", WORKER, mode, dir],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  const pid = child.pid;
  if (pid === undefined) throw new Error("worker did not start");
  const lines: string[] = [];
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`worker not ready: ${lines.join("|")}`)),
      30_000,
    );
    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      lines.push(...parts.filter(Boolean));
      if (ready(lines)) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  process.kill(pid, "SIGKILL"); // the captured PID only, never a pattern
  await exited;
  return lines;
}

const lastAck = (lines: string[]) =>
  Math.max(0, ...lines.filter((l) => l.startsWith("ack ")).map((l) => Number(l.slice(4))));

describe("crash durability (process killed by PID)", () => {
  it("1 streaming reply: every acknowledged commit survives and the file passes integrity_check", async () => {
    const dir = makeDir();
    const seedThreads = seedDatabase(dir);
    const lines = await runAndKill("stream", dir, (l) => lastAck(l) >= 200);
    const acked = lastAck(lines);
    const db = new NodeSqlite.DatabaseSync(NodePath.join(dir, "state.sqlite"));
    const rows = db.prepare("SELECT count(*) AS n FROM crash_probe").get() as { n: number };
    const check = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    const threads = db.prepare("SELECT count(*) AS n FROM crash_seed_threads").get() as {
      n: number;
    };
    db.close();
    expect(check.integrity_check).toBe("ok");
    expect(rows.n).toBeGreaterThanOrEqual(acked);
    expect(threads.n).toBe(seedThreads);
  }, 60_000);

  it("2 update install: a transaction cut before COMMIT leaves no partial rows and keeps old data", async () => {
    const dir = makeDir();
    const seedThreads = seedDatabase(dir);
    await runAndKill("transaction", dir, (l) => l.includes("open"));
    const db = new NodeSqlite.DatabaseSync(NodePath.join(dir, "state.sqlite"));
    const rows = db.prepare("SELECT count(*) AS n FROM crash_probe").get() as { n: number };
    const threads = db.prepare("SELECT count(*) AS n FROM crash_seed_threads").get() as {
      n: number;
    };
    db.close();
    expect(rows.n).toBe(0);
    expect(threads.n).toBe(seedThreads);
  }, 60_000);

  it("3 settings save: the file is always whole JSON from some acknowledged save", async () => {
    const dir = makeDir();
    const lines = await runAndKill("settings", dir, (l) => lastAck(l) >= 40);
    const acked = lastAck(lines);
    const parsed = JSON.parse(NodeFS.readFileSync(NodePath.join(dir, "settings.json"), "utf8")) as {
      seq: number;
    };
    expect(parsed.seq).toBeGreaterThanOrEqual(acked);
    const leftovers = NodeFS.readdirSync(dir).filter((name) => name.startsWith("settings.json."));
    // A killed save may leave its temp folder, but never a half-written settings.json.
    expect(NodeFS.statSync(NodePath.join(dir, "settings.json")).size).toBeGreaterThan(40_000);
    expect(leftovers.length).toBeLessThanOrEqual(1);
  }, 60_000);

  it("4 attachment upload: a killed upload leaves no final file and the sweeper removes the part", async () => {
    const dir = makeDir();
    const lines = await runAndKill("upload", dir, (l) => l.includes("half"));
    const attachmentsDir = lines.find((l) => l.startsWith("dir "))!.slice(4);
    const names = NodeFS.readdirSync(attachmentsDir);
    expect(names.some((n) => !n.endsWith(".part"))).toBe(false);
    const { sweepStalePendingAttachments } = await import("../attachmentStore.ts");
    const swept = sweepStalePendingAttachments({
      attachmentsDir,
      nowMs: Date.now() + 365 * 24 * 3_600_000,
    });
    expect(swept.deleted).toBe(names.length);
  }, 60_000);
});
