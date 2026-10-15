import type { ServerProvider } from "@t3tools/contracts";

/** Services people pay for come first; the rest follow by name. */
const GROUP_ORDER = ["claudeAgent", "codex", "antigravity", "gemini", "openrouter"];

/** Group account rows by service, in a fixed order that does not jump around. */
export function groupAccountRows<Row extends { readonly driver: string }>(
  rows: ReadonlyArray<Row>,
  labelFor: (driver: string) => string,
): ReadonlyArray<{ readonly driver: string; readonly rows: ReadonlyArray<Row> }> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const list = groups.get(row.driver) ?? [];
    list.push(row);
    groups.set(row.driver, list);
  }
  const rank = (driver: string) => {
    const index = GROUP_ORDER.indexOf(driver);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...groups]
    .toSorted(([a], [b]) => rank(a) - rank(b) || labelFor(a).localeCompare(labelFor(b), undefined))
    .map(([driver, list]) => ({ driver, rows: list }));
}

export type AccountAction = "install" | "signIn" | "addKey" | "settings";

export interface AccountStatus {
  /** ok: ready to use. attention: needs one step. off: turned off. checking: no data yet. */
  readonly tone: "ok" | "attention" | "off" | "checking";
  readonly text: string;
  readonly action: AccountAction | null;
}

/** "Claude Pro Subscription" reads as "Claude Pro". */
export function shortPlanLabel(label: string | undefined): string | null {
  const trimmed = label?.replace(/\s+subscription$/iu, "").trim();
  return trimmed ? trimmed : null;
}

/** One plain line about the account and the one step that fixes it. */
export function describeAccount(input: {
  readonly driver: string;
  readonly enabled: boolean;
  readonly needsApiKey: boolean;
  readonly provider: ServerProvider | undefined;
}): AccountStatus {
  const { driver, enabled, needsApiKey, provider } = input;
  if (needsApiKey) return { tone: "attention", text: "Needs an API key", action: "addKey" };
  if (!enabled) return { tone: "off", text: "Turned off", action: null };
  if (provider === undefined) return { tone: "checking", text: "Checking...", action: null };
  if (!provider.installed) {
    return driver === "claudeAgent"
      ? { tone: "attention", text: "Claude is not installed", action: "install" }
      : { tone: "attention", text: "Not installed", action: "settings" };
  }
  if (provider.auth.status === "unauthenticated") {
    return { tone: "attention", text: "Not signed in", action: "signIn" };
  }
  if (provider.status === "ready") {
    const parts = [provider.auth.email, shortPlanLabel(provider.auth.label)].filter(
      (part): part is string => Boolean(part),
    );
    return { tone: "ok", text: parts.join(" · ") || "Ready", action: null };
  }
  const firstLine = provider.message?.split("\n")[0]?.trim();
  return { tone: "attention", text: firstLine || "Needs attention", action: "settings" };
}

/** The fullest usage window, so the bar shows the limit you hit first. */
export function accountUsage(
  provider: ServerProvider | undefined,
): { readonly percent: number; readonly label: string } | null {
  const windows = provider?.usageLimits?.windows ?? [];
  let top: (typeof windows)[number] | undefined;
  for (const window of windows) {
    if (top === undefined || window.usedPercent > top.usedPercent) top = window;
  }
  return top ? { percent: Math.round(top.usedPercent), label: top.label } : null;
}
