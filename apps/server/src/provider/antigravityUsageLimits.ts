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
    );
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
 * Discovers the language_server.log path where active server port may be logged.
 */
export function resolveLanguageServerLogPath(): string | null {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    return appData ? Path.join(appData, "Antigravity", "logs", "language_server.log") : null;
  }
  if (process.platform === "darwin") {
    const home = process.env.HOME;
    return home
      ? Path.join(
          home,
          "Library",
          "Application Support",
          "Antigravity",
          "logs",
          "language_server.log",
        )
      : null;
  }
  const home = process.env.HOME;
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
          'wmic process where "name like \'%language_server%\'" get commandline',
          { timeout: 1500, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
        );
        const match = out.match(/--csrf_token\s+([^\s]+)/);
        if (match && match[1]) return match[1].trim();
      } catch {
        const out = ChildProcess.execSync(
          'powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -like \'*language_server*\' } | Select-Object -ExpandProperty CommandLine"',
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
      const match = out.match(/language_server.*--csrf_token\s+([^\s]+)/);
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
    const lines = content.split("\n").slice(-50);
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
  const exe = executablePath ?? resolveLanguageServerCandidates().find((p) => FS.existsSync(p));
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

/**
 * Probes the local Antigravity language server to obtain active account quota and plan status.
 */
export async function probeAntigravityUsageLimits(options?: {
  readonly executablePath?: string;
  readonly checkedAt?: string;
  readonly timeoutMs?: number;
}): Promise<AntigravityUsageLimitsProbeResult | null> {
  const checkedAt = options?.checkedAt ?? new Date().toISOString();

  // 1. Try running instance first (fastest)
  let statusResp = await probeRunningLanguageServer();

  // 2. Fall back to standalone probe if needed
  if (!statusResp?.userStatus) {
    statusResp = await probeStandaloneLanguageServer(options?.executablePath, options?.timeoutMs);
  }

  if (!statusResp?.userStatus) return null;

  const userStatus = statusResp.userStatus;
  const limits = antigravityUserStatusToLimits({ userStatus, checkedAt });
  const email = userStatus.email?.trim() || undefined;
  const plan = userStatus.planStatus?.planInfo?.planName?.trim() || undefined;

  return {
    limits,
    ...(email !== undefined ? { email } : {}),
    ...(plan !== undefined ? { plan } : {}),
  };
}

export interface AntigravityQuotaArbitrage {
  readonly windowId: string;
  readonly minutesUntilReset: number | null;
  readonly usedPercent: number;
  readonly remainingPercent: number;
  readonly burnPace: "surplus" | "balanced" | "deficit";
  readonly opportunisticDispatchEligible: boolean;
  readonly recommendation: "opportunistic_surplus" | "conserve_quota" | "nominal";
}

/**
 * Calculates quota velocity, consumption pace, and opportunistic capacity for an Antigravity window.
 */
export function evaluateAntigravityQuotaArbitrage(
  window: ServerProviderUsageWindow,
  nowMs = Date.now(),
): AntigravityQuotaArbitrage {
  let minutesUntilReset: number | null = null;
  if (window.resetsAt) {
    const resetTime = Date.parse(window.resetsAt);
    if (Number.isFinite(resetTime) && resetTime > nowMs) {
      minutesUntilReset = Math.round((resetTime - nowMs) / 60000);
    }
  }
  const usedPercent = Math.max(0, Math.min(100, Math.round(window.usedPercent)));
  const remainingPercent = 100 - usedPercent;

  const windowDuration = window.windowDurationMins ?? 300;
  const elapsedMinutes =
    minutesUntilReset !== null ? Math.max(0, windowDuration - minutesUntilReset) : null;
  const elapsedFraction = elapsedMinutes !== null ? elapsedMinutes / windowDuration : 0.5;
  const expectedUsedPercent = Math.round(elapsedFraction * 100);

  let burnPace: "surplus" | "balanced" | "deficit" = "balanced";
  if (usedPercent >= 90 || usedPercent > expectedUsedPercent + 15) {
    burnPace = "deficit";
  } else if (usedPercent < expectedUsedPercent - 15) {
    burnPace = "surplus";
  }

  const opportunisticDispatchEligible =
    (minutesUntilReset !== null && minutesUntilReset < 90 && usedPercent < 70) ||
    (burnPace === "surplus" && usedPercent < 60);

  const recommendation =
    usedPercent >= 85
      ? "conserve_quota"
      : opportunisticDispatchEligible
        ? "opportunistic_surplus"
        : "nominal";

  return {
    windowId: window.id,
    minutesUntilReset,
    usedPercent,
    remainingPercent,
    burnPace,
    opportunisticDispatchEligible,
    recommendation,
  };
}
