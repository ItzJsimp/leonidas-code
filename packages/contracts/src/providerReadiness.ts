import type { ServerProvider } from "./server.ts";

export type ProviderConnectionIssue =
  | "cli_missing"
  | "cli_too_old"
  | "signed_out"
  | "token_expired"
  | "quota_reached"
  | "network_blocked";

export interface ProviderReadiness {
  readonly color: "green" | "yellow" | "red";
  readonly code: ProviderConnectionIssue | "ready" | "unchecked" | "disabled";
  readonly reason: string;
  readonly action:
    | "install"
    | "sign_in"
    | "switch_account"
    | "wait"
    | "check"
    | "check_connection"
    | null;
  readonly resetsAt?: string;
}

/** Classify legacy probe messages without returning their potentially sensitive contents. */
export function classifyProviderConnectionIssue(
  message: string,
): ProviderConnectionIssue | undefined {
  if (
    /\b(token|credential|session)\b.{0,40}\b(expired|revoked|invalid)\b|\bexpired\b.{0,20}\btoken\b/i.test(
      message,
    )
  )
    return "token_expired";
  if (
    /not (?:logged|signed) in|unauthenticated|authentication required|401 Unauthorized/i.test(
      message,
    )
  )
    return "signed_out";
  if (
    /quota (?:exceeded|reached)|(?:usage|rate) limit|limit reached|resource_exhausted/i.test(
      message,
    )
  )
    return "quota_reached";
  if (
    /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|ECONNRESET|network (?:blocked|unreachable)|fetch failed|certificate (?:verify|has expired)|unable to (?:connect|verify)/i.test(
      message,
    )
  )
    return "network_blocked";
  return undefined;
}

/** One shared decision for picker status and account recovery. No probe runs here. */
export function getProviderReadiness(
  provider: ServerProvider | null | undefined,
  options: { readonly nowMs: number; readonly canSwitch?: boolean },
): ProviderReadiness {
  if (!provider)
    return { color: "yellow", code: "unchecked", reason: "Checking connection", action: "check" };
  if (!provider.enabled || provider.status === "disabled")
    return { color: "yellow", code: "disabled", reason: "Account off", action: null };
  const now = options.nowMs;
  const messageIssue =
    provider.connectionIssue ??
    (provider.status !== "ready"
      ? classifyProviderConnectionIssue(provider.message ?? "")
      : undefined) ??
    (provider.usageLimits?.unavailable?.reason === "probeFailed"
      ? classifyProviderConnectionIssue(provider.usageLimits.unavailable.message ?? "")
      : undefined);
  const compatibility = provider.compatibilityAdvisory?.status;
  const exhausted = (provider.usageLimits?.windows ?? []).filter(
    (window) =>
      window.usedPercent >= 100 &&
      (!window.resetsAt ||
        !Number.isFinite(Date.parse(window.resetsAt)) ||
        Date.parse(window.resetsAt) > now),
  );
  const issue =
    !provider.installed && provider.status === "error"
      ? "cli_missing"
      : compatibility === "unsupported" || compatibility === "broken"
        ? "cli_too_old"
        : messageIssue === "token_expired"
          ? messageIssue
          : provider.auth.status === "unauthenticated"
            ? "signed_out"
            : exhausted.length > 0
              ? "quota_reached"
              : messageIssue;
  if (issue === "cli_missing")
    return { color: "red", code: issue, reason: "CLI missing", action: "install" };
  if (issue === "cli_too_old")
    return { color: "red", code: issue, reason: "CLI update needed", action: "install" };
  if (issue === "signed_out" || issue === "token_expired")
    return {
      color: "red",
      code: issue,
      reason: issue === "signed_out" ? "Signed out" : "Token expired",
      action: "sign_in",
    };
  if (issue === "network_blocked")
    return {
      color: "red",
      code: issue,
      reason: "Network blocked",
      action: options.canSwitch ? "switch_account" : "check_connection",
    };
  if (issue === "quota_reached") {
    const resets = exhausted.map((window) => window.resetsAt);
    const resetsAt =
      resets.length > 0 && resets.every((reset) => reset && Number.isFinite(Date.parse(reset)))
        ? resets.reduce<string | undefined>(
            (latest, reset) =>
              !latest || Date.parse(reset!) > Date.parse(latest) ? reset : latest,
            undefined,
          )
        : undefined;
    return {
      color: "red",
      code: issue,
      reason: resetsAt ? "Quota reached" : "Quota reached; reset unknown",
      action: options.canSwitch ? "switch_account" : resetsAt ? "wait" : "check",
      ...(resetsAt ? { resetsAt } : {}),
    };
  }
  const checked = Date.parse(provider.checkedAt);
  if (
    !provider.installed ||
    provider.status !== "ready" ||
    provider.auth.status === "unknown" ||
    provider.usageLimits?.unavailable?.reason === "probeFailed" ||
    !Number.isFinite(checked) ||
    now - checked > 600_000
  ) {
    return {
      color: "yellow",
      code: "unchecked",
      reason: "Connection not verified",
      action: "check",
    };
  }
  return { color: "green", code: "ready", reason: "Connected", action: null };
}
