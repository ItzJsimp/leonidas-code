import { claudeFiveHourWindow } from "./headerStats";

type Accounts = Parameters<typeof claudeFiveHourWindow>[0];

/** Above this share used the meter turns to the warning color. */
const WARN_ABOVE = 80;

export interface FiveHourMeter {
  readonly percent: number;
  /** Bar fill, 0 to 100. */
  readonly fill: number;
  readonly level: "normal" | "warning";
  readonly tip: string;
}

/** The chat pane's 5-hour meter: null with no Claude account, else the numbers it draws. */
export function fiveHourMeter(
  accounts: Accounts,
  now: number,
  timeZone?: string,
): FiveHourMeter | null {
  const window = claudeFiveHourWindow(accounts, now);
  if (!window) return null;
  const percent = Math.round(window.usedPercent);
  const reset = window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt);
  const resets = Number.isFinite(reset)
    ? `, resets ${new Date(reset).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        ...(timeZone ? { timeZone } : {}),
      })}`
    : "";
  return {
    percent,
    fill: Math.min(100, Math.max(0, percent)),
    level: percent > WARN_ABOVE ? "warning" : "normal",
    tip: `Claude 5-hour window: ${percent} percent used${resets}`,
  };
}
