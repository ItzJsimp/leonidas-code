// @effect-diagnostics nodeBuiltinImport:off globalFetch:off globalTimers:off globalDate:off cryptoRandomUUID:off globalRandom:off
/**
 * Antigravity subscription usage and quota reader.
 *
 * Antigravity reports user plan quotas via its local language server
 * (`/exa.language_server_pb.LanguageServerService/GetUserStatus`).
 * The `cascadeModelConfigData.clientModelConfigs` list provides:
 * - Rolling 5-hour session quota for Gemini models (`remainingFraction`, `resetTime`)
 * - Weekly quota for Claude and secondary models (`remainingFraction`, `resetTime`)
 *
 * @module provider/antigravityUsageLimits
 */
import type {
  ProviderUsageLimitsUpdate,
  ServerProviderUsageLimits,
  ServerProviderUsageWindow,
} from "@t3tools/contracts";
import {
  clampPercent,
  makeUnavailableUsageLimits,
  makeUsageLimits,
} from "@t3tools/provider-core/server/usageLimits";
import {
  antigravityModelIdFromEnum,
  antigravityModelNameFromLabel,
  registerAntigravityModelNames,
  type AntigravityModelName,
} from "./antigravityModelNames.ts";
import * as ChildProcess from "node:child_process";
import * as FS from "node:fs";
import * as Path from "node:path";

const SESSION_MINS = 5 * 60; // 300 minutes (5 hours)
const WEEK_MINS = 7 * 24 * 60; // 10080 minutes (7 days)

export interface AntigravityQuotaInfo {
  readonly remainingFraction?: number | null;
  readonly resetTime?: string | null;
}

export interface AntigravityClientModelConfig {
  readonly label?: string | null;
  readonly modelOrAlias?: { readonly model?: string | null } | null;
  readonly quotaInfo?: AntigravityQuotaInfo | null;
}

export interface AntigravityUserStatus {
  readonly name?: string | null;
  readonly email?: string | null;
  readonly planStatus?: {
    readonly planInfo?: {
      readonly planName?: string | null;
      readonly teamsTier?: string | null;
    } | null;
    readonly availablePromptCredits?: number | null;
    readonly availableFlowCredits?: number | null;
  } | null;
  readonly cascadeModelConfigData?: {
    readonly clientModelConfigs?: ReadonlyArray<AntigravityClientModelConfig> | null;
  } | null;
}

export interface AntigravityGetUserStatusResponse {
  readonly userStatus?: AntigravityUserStatus | null;
}

export interface AntigravityUsageLimitsProbeResult {
  readonly limits: ServerProviderUsageLimits;
  readonly email?: string | undefined;
  readonly plan?: string | undefined;
}

let cachedProbeResult: { result: AntigravityUsageLimitsProbeResult; timestamp: number } | null =
  null;
const CACHE_TTL_MS = 60_000;

/**
 * Extracts session (5-hour) and weekly quota windows from GetUserStatus.
 */
export function antigravityUserStatusToWindows(
  userStatus: AntigravityUserStatus | null | undefined,
): ReadonlyArray<ServerProviderUsageWindow> {
  if (!userStatus) return [];
  const configs = userStatus.cascadeModelConfigData?.clientModelConfigs ?? [];
  const windows: ServerProviderUsageWindow[] = [];

  // 1. Session window: find a Gemini model quota
  const geminiConfig = configs.find(
    (c) =>
      typeof c.label === "string" &&
      /gemini/i.test(c.label) &&
      c.quotaInfo &&
      typeof c.quotaInfo.remainingFraction === "number",
  );
  if (geminiConfig?.quotaInfo && typeof geminiConfig.quotaInfo.remainingFraction === "number") {
    const fraction = geminiConfig.quotaInfo.remainingFraction;
    const usedPercent = clampPercent(Math.round((1 - fraction) * 100));
    windows.push({
      id: "session",
      kind: "session",
      label: "Session",
      windowDurationMins: SESSION_MINS,
      usedPercent,
      ...(geminiConfig.quotaInfo.resetTime ? { resetsAt: geminiConfig.quotaInfo.resetTime } : {}),
    });
  }

  // 2. Weekly window: find a Claude / secondary model quota
  const weeklyConfig = configs.find(
    (c) =>
      typeof c.label === "string" &&
      !/gemini/i.test(c.label) &&
      c.quotaInfo &&
      typeof c.quotaInfo.remainingFraction === "number",
  );
  if (weeklyConfig?.quotaInfo && typeof weeklyConfig.quotaInfo.remainingFraction === "number") {
    const fraction = weeklyConfig.quotaInfo.remainingFraction;
    const usedPercent = clampPercent(Math.round((1 - fraction) * 100));
    windows.push({
      id: "weekly",
      kind: "weekly",
      label: "Weekly",
      windowDurationMins: WEEK_MINS,
      usedPercent,
      ...(weeklyConfig.quotaInfo.resetTime ? { resetsAt: weeklyConfig.quotaInfo.resetTime } : {}),
    });
  }

  return windows;
}

/**
 * Names the account's models by numeric id. GetUserStatus lists each model as an
 * enum such as `MODEL_PLACEHOLDER_M319` (id 1319) with its picker label, which is
 * the only place the ids that usage records carry get a readable name.
 */
export function antigravityModelNamesFromConfigs(
  configs: ReadonlyArray<AntigravityClientModelConfig> | null | undefined,
): Map<number, AntigravityModelName> {
  const names = new Map<number, AntigravityModelName>();
  for (const config of configs ?? []) {
    const id = antigravityModelIdFromEnum(config.modelOrAlias?.model ?? "");
    const label = config.label?.trim();
    if (id !== null && label) names.set(id, antigravityModelNameFromLabel(label));
  }
  return names;
}

export function antigravityUserStatusToLimits(input: {
  readonly userStatus: AntigravityUserStatus | null | undefined;
  readonly checkedAt: string;
}): ServerProviderUsageLimits {
  const windows = antigravityUserStatusToWindows(input.userStatus);
  if (windows.length === 0) {
    return makeUnavailableUsageLimits({
      checkedAt: input.checkedAt,
      reason: "probeFailed",
      message: "No Antigravity quota information reported.",
    });
  }
  return makeUsageLimits({
    checkedAt: input.checkedAt,
    windows,
  });
}

export function antigravityUserStatusToUpdate(
  userStatus: AntigravityUserStatus,
): ProviderUsageLimitsUpdate | undefined {
  const windows = antigravityUserStatusToWindows(userStatus);
  return windows.length > 0 ? { windows } : undefined;
}

/**
 * Discovers candidate paths for language_server executable.
 */
export function resolveLanguageServerCandidates(): string[] {
  const candidates: string[] = [];
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? "";
    if (localAppData) {
      candidates.push(
        Path.join(
          localAppData,
          "Programs",
          "antigravity",
          "resources",
          "bin",
          "language_server.exe",
        ),
      );
    }
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    candidates.push(
      Path.join(programFiles, "Antigravity", "resources", "bin", "language_server.exe"),
      Path.join(programFiles, "Programs", "antigravity", "resources", "bin", "language_server.exe"),
    );
    const userProfile = process.env.USERPROFILE ?? "";
    if (userProfile) {
      candidates.push(
        Path.join(
          userProfile,
          "AppData",
          "Local",
          "Programs",
          "antigravity",
          "resources",
          "bin",
          "language_server.exe",
        ),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Antigravity.app/Contents/Resources/bin/language_server",
      Path.join(
        process.env.HOME ?? "",
        "Applications",
        "Antigravity.app",
        "Contents",
        "Resources",
        "bin",
        "language_server",
      ),
    );
  } else {
    candidates.push(
      "/usr/share/antigravity/resources/bin/language_server",
      Path.join(
        process.env.HOME ?? "",
        ".local",
        "share",
        "antigravity",
        "resources",
        "bin",
        "language_server",
      ),
      "/opt/antigravity/resources/bin/language_server",
    );
  }
  return candidates;
}

/**
 * Discovers the language_server.log or cli-*.log path where active server port may be logged.
 */
export function resolveLanguageServerLogPath(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  // Check ~/.gemini/antigravity/log/ for newest cli-*.log
  if (home) {
    const geminiLogDir = Path.join(home, ".gemini", "antigravity", "log");
    try {
      if (FS.existsSync(geminiLogDir)) {
        const files = FS.readdirSync(geminiLogDir)
          .filter((f) => f.startsWith("cli-") && f.endsWith(".log"))
          .map((f) => ({
            path: Path.join(geminiLogDir, f),
            mtime: FS.statSync(Path.join(geminiLogDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0 && files[0]) {
          return files[0].path;
        }
      }
    } catch {
      // Ignore directory read failure
    }
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      const p = Path.join(appData, "Antigravity", "logs", "language_server.log");
      if (FS.existsSync(p)) return p;
    }
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const p = Path.join(localAppData, "Antigravity", "logs", "language_server.log");
      if (FS.existsSync(p)) return p;
    }
    return null;
  }
  if (process.platform === "darwin") {
    if (home) {
      return Path.join(
        home,
        "Library",
        "Application Support",
        "Antigravity",
        "logs",
        "language_server.log",
      );
    }
    return null;
  }
  return home ? Path.join(home, ".config", "Antigravity", "logs", "language_server.log") : null;
}

/**
 * Discovers the CSRF token of a currently running Antigravity language_server process.
 */
export function discoverRunningCsrfToken(): string | null {
  try {
    if (process.platform === "win32") {
      try {
        const out = ChildProcess.execSync(
          "wmic process where \"name like '%language_server%'\" get commandline",
          { timeout: 1500, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
        );
        const match = out.match(/--csrf_token\s+([^\s]+)/);
        if (match && match[1]) return match[1].trim();
      } catch {
        const out = ChildProcess.execSync(
          "powershell -NoProfile -NonInteractive -Command \"Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*language_server*' } | Select-Object -ExpandProperty CommandLine\"",
          { timeout: 2500, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
        );
        const match = out.match(/--csrf_token\s+([^\s]+)/);
        if (match && match[1]) return match[1].trim();
      }
    } else {
      const out = ChildProcess.execSync("ps -eo command", {
        timeout: 1500,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const match = out.match(/language_server.*--csrf_token\s+([^\\s]+)/);
      if (match && match[1]) return match[1].trim();
    }
  } catch {
    // Process inspection unavailable
  }
  return null;
}

export async function queryLanguageServerPort(
  port: number,
  csrfToken?: string,
  timeoutMs = 1500,
): Promise<AntigravityGetUserStatusResponse | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) {
      headers["x-codeium-csrf-token"] = csrfToken;
    }
    const res = await fetch(
      `http://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUserStatus`,
      {
        method: "POST",
        headers,
        body: "{}",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as AntigravityGetUserStatusResponse;
  } catch {
    return null;
  }
}

/**
 * Checks if a language server is currently running and listening on a logged port.
 */
export async function probeRunningLanguageServer(): Promise<AntigravityGetUserStatusResponse | null> {
  const logPath = resolveLanguageServerLogPath();
  if (!logPath || !FS.existsSync(logPath)) return null;

  try {
    const content = await FS.promises.readFile(logPath, "utf-8");
    const lines = content.split("\n").slice(-100);
    let lastPort: number | null = null;
    for (const line of lines) {
      const match = line.match(/listening on random port at (\d+) for HTTP\b/);
      if (match && match[1]) {
        lastPort = parseInt(match[1], 10);
      }
    }
    if (lastPort && lastPort > 0) {
      const csrfToken = discoverRunningCsrfToken() ?? undefined;
      return await queryLanguageServerPort(lastPort, csrfToken, 2000);
    }
  } catch {
    // Log unreadable or missing
  }
  return null;
}

/**
 * Spawns a standalone language server instance, captures its port, queries GetUserStatus,
 * and shuts it down.
 */
export async function probeStandaloneLanguageServer(
  executablePath?: string,
  timeoutMs = 6000,
): Promise<AntigravityGetUserStatusResponse | null> {
  const isLanguageServer = (p?: string) =>
    typeof p === "string" &&
    p.length > 0 &&
    (Path.basename(p).toLowerCase().startsWith("language_server") ||
      Path.basename(p).toLowerCase().startsWith("language-server"));
  const exe =
    isLanguageServer(executablePath) && FS.existsSync(executablePath!)
      ? executablePath!
      : resolveLanguageServerCandidates().find((p) => FS.existsSync(p));
  if (!exe || !FS.existsSync(exe)) return null;

  const csrfToken =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `t3-antigravity-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return new Promise<AntigravityGetUserStatusResponse | null>((resolve) => {
    let proc: ChildProcess.ChildProcess | null = null;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (proc) {
        try {
          proc.stdin?.end();
          proc.kill();
        } catch {
          // Process already ended
        }
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    try {
      proc = ChildProcess.spawn(
        exe,
        [
          "--standalone",
          "--override_ide_name",
          "antigravity",
          "--subclient_type",
          "hub",
          "--override_ide_version",
          "2.22.0",
          "--override_user_agent_name",
          "antigravity",
          "--http_server_port",
          "0",
          "--csrf_token",
          csrfToken,
          "--app_data_dir",
          "antigravity",
          "--api_server_url",
          "https://generativelanguage.googleapis.com",
          "--cloud_code_endpoint",
          "https://daily-cloudcode-pa.googleapis.com",
          "--exit_on_stdin_close",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );

      let port: number | null = null;

      proc.stderr?.on("data", async (chunk: Buffer) => {
        const text = chunk.toString();
        const m = text.match(/listening on random port at (\d+) for HTTP\b/);
        if (m && m[1]) {
          port = parseInt(m[1], 10);
        }
        if (text.includes("initialized server successfully") && port && !finished) {
          try {
            const result = await queryLanguageServerPort(port, csrfToken, 2500);
            clearTimeout(timer);
            cleanup();
            resolve(result);
          } catch {
            clearTimeout(timer);
            cleanup();
            resolve(null);
          }
        }
      });

      proc.on("error", () => {
        clearTimeout(timer);
        cleanup();
        resolve(null);
      });

      proc.on("exit", () => {
        clearTimeout(timer);
        cleanup();
        resolve(null);
      });
    } catch {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    }
  });
}

export function readFallbackGoogleAccount(): { email?: string; plan?: string } {
  try {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    if (home) {
      const googleAccountsPath = Path.join(home, ".gemini", "google_accounts.json");
      if (FS.existsSync(googleAccountsPath)) {
        const data = JSON.parse(FS.readFileSync(googleAccountsPath, "utf-8"));
        if (typeof data.active === "string" && data.active.trim()) {
          return { email: data.active.trim(), plan: "Google account" };
        }
      }
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Probes the local Antigravity language server to obtain active account quota and plan status.
 */
export async function probeAntigravityUsageLimits(options?: {
  readonly executablePath?: string;
  readonly checkedAt?: string;
  readonly timeoutMs?: number;
}): Promise<AntigravityUsageLimitsProbeResult | null> {
  const now = Date.now();
  if (cachedProbeResult && now - cachedProbeResult.timestamp < CACHE_TTL_MS) {
    return cachedProbeResult.result;
  }

  const checkedAt = options?.checkedAt ?? new Date().toISOString();

  // 1. Try running instance first (fastest)
  let statusResp = await probeRunningLanguageServer();

  // 2. Fall back to standalone probe if needed
  if (!statusResp?.userStatus) {
    statusResp = await probeStandaloneLanguageServer(options?.executablePath, options?.timeoutMs);
  }

  if (!statusResp?.userStatus) {
    const fallback = readFallbackGoogleAccount();
    if (fallback.email) {
      const result: AntigravityUsageLimitsProbeResult = {
        limits: makeUsageLimits({
          checkedAt,
          windows: [],
        }),
        email: fallback.email,
        plan: fallback.plan ?? "Google account",
      };
      cachedProbeResult = { result, timestamp: now };
      return result;
    }
    return null;
  }

  const userStatus = statusResp.userStatus;
  registerAntigravityModelNames(
    antigravityModelNamesFromConfigs(userStatus.cascadeModelConfigData?.clientModelConfigs),
  );
  const limits = antigravityUserStatusToLimits({ userStatus, checkedAt });
  const email = userStatus.email?.trim() || undefined;
  const plan = userStatus.planStatus?.planInfo?.planName?.trim() || undefined;

  const result: AntigravityUsageLimitsProbeResult = {
    limits,
    ...(email !== undefined ? { email } : {}),
    ...(plan !== undefined ? { plan } : {}),
  };
  cachedProbeResult = { result, timestamp: now };
  return result;
}
