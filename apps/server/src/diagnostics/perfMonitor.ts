// @effect-diagnostics nodeBuiltinImport:off - perf events are appended synchronously from non-Effect hot paths.
// @effect-diagnostics globalDate:off - timing reads the wall clock directly; the monitor runs outside Effect.
// @effect-diagnostics globalConsole:off - the monitor warns on stderr when perf logging itself fails.
/**
 * Leonidas performance emitter (TypeScript, node built-ins only).
 *
 * Canonical copy: templates/perf-emitters/perfMonitor.ts. Vendored into projects; a drift check
 * compares hashes. Rules live in standards/perf-thresholds.json, events go to logs/perf-events.jsonl.
 * Same behaviour as perf_monitor.py: record() never throws, appends one JSONL row and, on a breach,
 * runs one detached scripts/Send-PerfAlert.ps1.
 */
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  closeSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

type Rule = {
  label?: string;
  critical_ms?: number | null;
  baseline_window_days: number;
  baseline_min_samples: number;
  baseline_multiplier: number;
  baseline_floor_ms: number;
  escalate_n: number;
  escalate_m: number;
  cooldown_minutes: number;
};
type Config = { log?: string; defaults: Rule; metrics: Record<string, Partial<Rule>> };
export type PerfState = "ok" | "slow" | "critical";
export type PerfAlertKind = "spike" | "escalated";

const FALLBACK: Config = {
  log: "logs/perf-events.jsonl",
  defaults: {
    baseline_window_days: 7,
    baseline_min_samples: 20,
    baseline_multiplier: 3,
    baseline_floor_ms: 2000,
    escalate_n: 3,
    escalate_m: 10,
    cooldown_minutes: 30,
  },
  metrics: {},
};
const TAIL_BYTES = 4 * 1024 * 1024;
const BASELINE_TTL_MS = 300_000;
const SPIKE_GAP_MS = 120_000;

export function findAiosRoot(start: string = process.cwd()): string | null {
  const env = process.env.LEONIDAS_AIOS_ROOT;
  if (env && existsSync(join(env, "standards", "perf-thresholds.json"))) return env;
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "standards", "perf-thresholds.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export class PerfMonitor {
  private readonly root: string | null;
  private cfg: Config | null = null;
  private cfgMtime = 0;
  private readonly recent = new Map<string, boolean[]>();
  private readonly baseline = new Map<string, { at: number; p95: number | null }>();
  private readonly cooldown = new Map<string, number>();
  private readonly lastSpike = new Map<string, number>();

  private readonly component: string;
  private readonly muted: boolean;
  private readonly onAlert: ((kind: PerfAlertKind, message: string) => void) | undefined;

  constructor(
    component: string,
    options: {
      root?: string | null;
      onAlert?: (kind: PerfAlertKind, message: string) => void;
    } = {},
  ) {
    this.component = component;
    this.root = options.root === undefined ? findAiosRoot() : options.root;
    // Test runs that did not pass an explicit root must never write to the real log.
    this.muted = options.root === undefined && Boolean(process.env.VITEST);
    this.onAlert = options.onAlert;
  }

  private config(): Config {
    try {
      const path = join(this.root as string, "standards", "perf-thresholds.json");
      const m = statSync(path).mtimeMs;
      if (!this.cfg || m !== this.cfgMtime) {
        this.cfg = JSON.parse(readFileSync(path, "utf8")) as Config;
        this.cfgMtime = m;
      }
    } catch {
      this.cfg = this.cfg ?? FALLBACK;
    }
    return this.cfg;
  }

  private logPath(cfg: Config): string {
    return this.root
      ? join(this.root, cfg.log ?? "logs/perf-events.jsonl")
      : join(homedir(), ".leonidas", "perf-events.jsonl");
  }

  private p95(cfg: Config, metric: string, rule: Rule): number | null {
    const now = Date.now();
    const cached = this.baseline.get(metric);
    if (cached && now - cached.at < BASELINE_TTL_MS) return cached.p95;
    const vals: number[] = [];
    const cutoff = now - rule.baseline_window_days * 86_400_000;
    try {
      const path = this.logPath(cfg);
      const size = statSync(path).size;
      const start = Math.max(0, size - TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      const fd = openSync(path, "r");
      try {
        readSync(fd, buf, 0, buf.length, start);
      } finally {
        closeSync(fd);
      }
      for (const line of buf.toString("utf8").split("\n")) {
        if (!line.includes(metric)) continue;
        try {
          const e = JSON.parse(line) as { ts: string; metric: string; value_ms: number };
          if (e.metric === metric && Date.parse(e.ts) >= cutoff) vals.push(e.value_ms);
        } catch {
          /* partial line at the tail window edge */
        }
      }
    } catch {
      /* no log yet */
    }
    let p95: number | null = null;
    if (vals.length >= rule.baseline_min_samples) {
      vals.sort((a, b) => a - b);
      p95 = vals[Math.min(vals.length - 1, Math.ceil(vals.length * 0.95) - 1)] ?? null;
    }
    this.baseline.set(metric, { at: now, p95 });
    return p95;
  }

  /** Log one measurement and return its state. Never throws. */
  record(metric: string, valueMs: number, tags: Record<string, unknown> = {}): PerfState {
    try {
      return this.recordUnsafe(metric, valueMs, tags);
    } catch (error) {
      console.warn(`[perfMonitor] ${error instanceof Error ? error.message : String(error)}`);
      return "ok";
    }
  }

  private recordUnsafe(metric: string, valueMs: number, tags: Record<string, unknown>): PerfState {
    if (this.muted) return "ok";
    const cfg = this.config();
    const rule = { ...cfg.defaults, ...cfg.metrics[metric] } as Rule;
    const crit = rule.critical_ms ?? null;
    const p95 = this.p95(cfg, metric, rule);
    const overBaseline =
      p95 !== null && valueMs > p95 * rule.baseline_multiplier && valueMs > rule.baseline_floor_ms;
    const state: PerfState =
      crit !== null && valueMs >= crit ? "critical" : overBaseline ? "slow" : "ok";
    const clean = Object.fromEntries(
      Object.entries(tags).filter(([, v]) => v !== undefined && v !== null),
    );
    const row = {
      ts: new Date().toISOString(),
      component: this.component,
      metric,
      value_ms: Math.round(valueMs * 10) / 10,
      state,
      baseline_p95_ms: p95 === null ? null : Math.round(p95 * 10) / 10,
      ...(Object.keys(clean).length > 0 ? { tags: clean } : {}),
    };
    const path = this.logPath(cfg);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");

    const now = Date.now();
    const recent = this.recent.get(metric) ?? [];
    recent.push(state !== "ok");
    while (recent.length > rule.escalate_m) recent.shift();
    this.recent.set(metric, recent);
    const escalated =
      recent.filter(Boolean).length >= rule.escalate_n &&
      now - (this.cooldown.get(metric) ?? 0) > rule.cooldown_minutes * 60_000;
    const spike =
      state === "critical" && !escalated && now - (this.lastSpike.get(metric) ?? 0) > SPIKE_GAP_MS;
    if (escalated) {
      this.cooldown.set(metric, now);
      recent.length = 0;
    }
    if (spike) this.lastSpike.set(metric, now);
    const label = rule.label ?? metric;
    if (escalated) {
      this.alert(
        "escalated",
        metric,
        valueMs,
        `${label}: ${rule.escalate_n} slow events in the last ${rule.escalate_m}.`,
      );
    } else if (spike) {
      this.alert(
        "spike",
        metric,
        valueMs,
        `${label} hit ${(valueMs / 1000).toFixed(1)}s (critical at ${((crit ?? 0) / 1000).toFixed(0)}s).`,
      );
    }
    return state;
  }

  private alert(kind: PerfAlertKind, metric: string, valueMs: number, message: string): void {
    try {
      this.onAlert?.(kind, message);
    } catch {
      /* alert hooks are best effort */
    }
    const script = this.root ? join(this.root, "scripts", "Send-PerfAlert.ps1") : null;
    if (!script || !existsSync(script)) return;
    const child = spawn(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        script,
        "-Component",
        this.component,
        "-Metric",
        metric,
        "-Mode",
        kind === "spike" ? "Spike" : "Escalated",
        "-ValueMs",
        String(valueMs),
        "-Detail",
        message,
      ],
      { detached: true, stdio: "ignore", windowsHide: true },
    );
    child.on("error", () => undefined);
    child.unref();
  }
}
