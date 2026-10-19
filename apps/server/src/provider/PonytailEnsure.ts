// @effect-diagnostics nodeBuiltinImport:off globalTimers:off - small detached installer, no Effect runtime needed
/**
 * Ponytail plugin for Claude accounts.
 *
 * The Ponytail rules already reach every provider through `buildRuntimeInstructions`. The Claude
 * plugin adds `/ponytail` levels, its skills and a per-turn cost ledger. This module installs it
 * once for each Claude config dir (each account), so a new account needs no setup.
 *
 * It never overrides a user choice: if `settings.json` already lists the plugin (on or off), it
 * does nothing. It needs `node` on PATH for the plugin hooks; without it the rules in the runtime
 * instructions still apply.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

export const PONYTAIL_PLUGIN_ID = "ponytail@ponytail";
const PONYTAIL_MARKETPLACE = "DietrichGebert/ponytail";
const COMMAND_TIMEOUT_MS = 120_000;
/** Wait before the first install so it never competes with server start. */
const START_DELAY_MS = 30_000;

const attempted = new Set<string>();

export function claudeConfigDirOf(env: NodeJS.ProcessEnv | undefined): string {
  const configured = env?.CLAUDE_CONFIG_DIR?.trim();
  return configured ? NodePath.resolve(configured) : NodePath.join(NodeOS.homedir(), ".claude");
}

function readEnabledPlugins(configDir: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(
      NodeFS.readFileSync(NodePath.join(configDir, "settings.json"), "utf8"),
    );
    const plugins = parsed?.enabledPlugins;
    return plugins && typeof plugins === "object" ? plugins : {};
  } catch {
    return undefined;
  }
}

/** True when the plugin injects the rules for this account, so the app skips its own copy. */
export function isPonytailPluginEnabled(env: NodeJS.ProcessEnv | undefined): boolean {
  return readEnabledPlugins(claudeConfigDirOf(env))?.[PONYTAIL_PLUGIN_ID] === true;
}

function run(file: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    NodeChildProcess.execFile(
      file,
      [...args],
      { env, timeout: COMMAND_TIMEOUT_MS, windowsHide: true },
      (error) => resolve(error === null),
    );
  });
}

/** Install the plugin for one Claude account. Never throws; a failed try repeats at next start. */
export async function ensureClaudePonytail(input: {
  readonly binaryPath: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<"installed" | "present" | "skipped" | "failed"> {
  const configDir = claudeConfigDirOf(input.env);
  if (attempted.has(configDir)) return "skipped";
  attempted.add(configDir);
  const settings = readEnabledPlugins(configDir);
  if (settings !== undefined && PONYTAIL_PLUGIN_ID in settings) return "present";
  const env = { ...input.env, CLAUDE_CONFIG_DIR: configDir };
  if (!(await run("node", ["--version"], env))) return "skipped";
  const claude = input.binaryPath.trim() || "claude";
  const added = await run(claude, ["plugin", "marketplace", "add", PONYTAIL_MARKETPLACE], env);
  const installed =
    added && (await run(claude, ["plugin", "install", PONYTAIL_PLUGIN_ID, "--scope", "user"], env));
  if (!installed) attempted.delete(configDir);
  return installed ? "installed" : "failed";
}

/** Fire and forget, delayed, from the driver. */
export function scheduleClaudePonytail(input: {
  readonly binaryPath: string;
  readonly env: NodeJS.ProcessEnv;
}): void {
  setTimeout(() => void ensureClaudePonytail(input), START_DELAY_MS).unref();
}
