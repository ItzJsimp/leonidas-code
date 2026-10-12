import type { KeybindingCommand, UsageSummaryInput } from "@t3tools/contracts";
import { makeWindow } from "@t3tools/shared/usageFormat";

/**
 * Preselected time ranges. Anything up to a day is a rolling window answered
 * in `bucketMinutes` buckets (the server caps those at 24 hours); longer
 * ranges are whole calendar days.
 */
export const USAGE_RANGES = [
  { id: "15m", label: "15m", long: "Past 15 minutes", minutes: 15, bucketMinutes: 1 },
  { id: "30m", label: "30m", long: "Past 30 minutes", minutes: 30, bucketMinutes: 1 },
  { id: "1h", label: "1h", long: "Past hour", minutes: 60, bucketMinutes: 2 },
  { id: "3h", label: "3h", long: "Past 3 hours", minutes: 180, bucketMinutes: 5 },
  { id: "6h", label: "6h", long: "Past 6 hours", minutes: 360, bucketMinutes: 10 },
  { id: "12h", label: "12h", long: "Past 12 hours", minutes: 720, bucketMinutes: 15 },
  {
    id: "24h",
    label: "24h",
    long: "Past 24 hours",
    minutes: 1440,
    bucketMinutes: 60,
    command: "usage.period.day",
  },
  { id: "7d", label: "7d", long: "Past 7 days", days: 7, command: "usage.period.week" },
  { id: "30d", label: "30d", long: "Past 30 days", days: 30, command: "usage.period.month" },
  { id: "90d", label: "90d", long: "Past 90 days", days: 90, command: "usage.period.quarter" },
] as const satisfies readonly {
  id: string;
  label: string;
  long: string;
  minutes?: number;
  bucketMinutes?: number;
  days?: number;
  command?: KeybindingCommand;
}[];

export type UsageRange = (typeof USAGE_RANGES)[number];
export type UsageRangeId = UsageRange["id"];
export const USAGE_RANGE_IDS = USAGE_RANGES.map((range) => range.id) as readonly UsageRangeId[];

export const rangeById = (id: UsageRangeId): UsageRange =>
  USAGE_RANGES.find((range) => range.id === id) ?? USAGE_RANGES[9];

/** Maps the retired day-count preference onto a range. */
export const rangeIdForDays = (days: number): UsageRangeId =>
  days === 1 ? "24h" : days === 7 ? "7d" : days === 90 ? "90d" : "30d";

/** Width of one chart/table period, in minutes, for an hourly range. */
export const bucketMinutesOf = (range: UsageRange): number =>
  "bucketMinutes" in range ? range.bucketMinutes : 60;

export function makeRangeWindow(id: UsageRangeId, now = new Date()): UsageSummaryInput {
  const range = rangeById(id);
  if ("minutes" in range) {
    return makeWindow(1, now, "hour", {
      minutes: range.minutes,
      bucketMinutes: range.bucketMinutes,
    });
  }
  return makeWindow(range.days, now, "day");
}
