/**
 * Usage history forecasting for provider subscription quotas.
 *
 * Models an account's historical burn rate across the 168 hours of the week
 * (by day of week and hour of day) from past quota observations or token logs.
 * Projects where a rolling window will land at reset by integrating expected
 * historical burn over the remaining duration [now, resetsAt], blended with
 * the current window's real-time pace.
 *
 * @module usageForecast
 */
import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import { elapsedShare } from "./usageLimits.ts";

const HOUR_MS = 60 * 60 * 1000;
const MAX_INTERVAL_GAP_MS = 12 * HOUR_MS;

/** A single historical observation for a window. */
export interface UsageObservationPoint {
  readonly checkedAt: number;
  readonly usedPercent: number;
  readonly resetsAt?: string | undefined;
}

/** Slot in the weekly calendar: burn rate (% per hour) and observed hours. */
export interface HourlyBurnRate {
  readonly ratePerHour: number;
  readonly observedHours: number;
}

/**
 * Weekly diurnal burn profile for an account and window kind.
 */
export interface UsageHistoryProfile {
  /** 7 days x 24 hours of burn rates (% per hour) in UTC. */
  readonly weeklySlots: ReadonlyArray<ReadonlyArray<HourlyBurnRate>>;
  /** 24 hours of diurnal burn rates aggregated across all days. */
  readonly diurnalHours: ReadonlyArray<HourlyBurnRate>;
  /** Overall average burn rate per hour during active periods. */
  readonly globalBurnPerHour: number;
  /** Total observation intervals analyzed. */
  readonly sampleCount: number;
}

/**
 * Builds a 7x24 weekly burn profile from a sequence of historical observations.
 * Consecutive observations in the same reset cycle calculate observed burn
 * rates attributed across the UTC hour-of-week slots they span.
 */
export function buildUsageHistoryProfile(
  observations: ReadonlyArray<UsageObservationPoint>,
): UsageHistoryProfile {
  const sorted = [...observations].sort((a, b) => a.checkedAt - b.checkedAt);

  // 168 weekly slots (7 days x 24 hours) accumulators
  const observedHours = new Array<number>(168).fill(0);
  const consumedPercent = new Array<number>(168).fill(0);
  let sampleCount = 0;
  let totalObservedHours = 0;
  let totalConsumedPercent = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const deltaMs = curr.checkedAt - prev.checkedAt;
    if (deltaMs <= 0 || deltaMs > MAX_INTERVAL_GAP_MS) continue;

    // Check if both observations belong to the same window cycle
    const sameReset =
      prev.resetsAt !== undefined && curr.resetsAt !== undefined
        ? prev.resetsAt === curr.resetsAt
        : curr.usedPercent >= prev.usedPercent;

    if (!sameReset || curr.usedPercent < prev.usedPercent) {
      // Crossed a reset cycle boundary
      continue;
    }

    const deltaPercent = Math.max(0, curr.usedPercent - prev.usedPercent);
    const durationHours = deltaMs / HOUR_MS;
    const intervalRate = durationHours > 0 ? deltaPercent / durationHours : 0;

    // Attribute this interval across the hour-of-week slots it touches
    let t = prev.checkedAt;
    while (t < curr.checkedAt) {
      const nextHourStart = (Math.floor(t / HOUR_MS) + 1) * HOUR_MS;
      const sliceEnd = Math.min(curr.checkedAt, nextHourStart);
      const sliceHours = (sliceEnd - t) / HOUR_MS;

      const date = DateTime.toDate(DateTime.makeUnsafe(t));
      const day = date.getUTCDay();
      const hour = date.getUTCHours();
      const slotIndex = day * 24 + hour;

      observedHours[slotIndex] = (observedHours[slotIndex] ?? 0) + sliceHours;
      consumedPercent[slotIndex] = (consumedPercent[slotIndex] ?? 0) + sliceHours * intervalRate;

      t = sliceEnd;
    }

    totalObservedHours += durationHours;
    totalConsumedPercent += deltaPercent;
    sampleCount++;
  }

  const weeklySlots: HourlyBurnRate[][] = [];
  for (let d = 0; d < 7; d++) {
    const daySlots: HourlyBurnRate[] = [];
    for (let h = 0; h < 24; h++) {
      const idx = d * 24 + h;
      const hours = observedHours[idx] ?? 0;
      const percent = consumedPercent[idx] ?? 0;
      daySlots.push({
        ratePerHour: hours > 0 ? percent / hours : 0,
        observedHours: hours,
      });
    }
    weeklySlots.push(daySlots);
  }

  const diurnalHours: HourlyBurnRate[] = [];
  for (let h = 0; h < 24; h++) {
    let hourTotalObserved = 0;
    let hourTotalConsumed = 0;
    for (let d = 0; d < 7; d++) {
      const idx = d * 24 + h;
      hourTotalObserved += observedHours[idx] ?? 0;
      hourTotalConsumed += consumedPercent[idx] ?? 0;
    }
    diurnalHours.push({
      ratePerHour: hourTotalObserved > 0 ? hourTotalConsumed / hourTotalObserved : 0,
      observedHours: hourTotalObserved,
    });
  }

  const globalBurnPerHour = totalObservedHours > 0 ? totalConsumedPercent / totalObservedHours : 0;

  return {
    weeklySlots,
    diurnalHours,
    globalBurnPerHour,
    sampleCount,
  };
}

/**
 * Projects the used percentage of a quota window at reset time.
 * If `window.projectedUsedPercentAtReset` is already set, returns it directly.
 * Integrates expected burn from historical diurnal patterns across [now, resetsAt],
 * and blends it with real-time session pace when available.
 */
export function forecastWindowUsedPercentAtReset(
  window: ServerProviderUsageWindow,
  now: number,
  history?: UsageHistoryProfile | ReadonlyArray<UsageObservationPoint>,
): number | null {
  if (window.projectedUsedPercentAtReset !== undefined) {
    return window.projectedUsedPercentAtReset;
  }

  if (window.resetsAt === undefined) return null;
  const resetsAtMs = Date.parse(window.resetsAt);
  if (!Number.isFinite(resetsAtMs)) return null;

  if (now >= resetsAtMs) {
    return window.usedPercent;
  }

  const hoursLeft = Math.max(0, (resetsAtMs - now) / HOUR_MS);
  if (hoursLeft <= 0) return window.usedPercent;

  // Real-time current-window pace (if enough of the window has elapsed)
  const durationMins =
    window.windowDurationMins ??
    (window.kind === "session" ? 300 : window.kind === "weekly" ? 10080 : undefined);
  const elapsed = elapsedShare(
    durationMins !== undefined && window.windowDurationMins === undefined
      ? { ...window, windowDurationMins: durationMins }
      : window,
    now,
  );
  const currentPaceProjected =
    elapsed !== null && elapsed >= 0.1 && durationMins !== undefined
      ? window.usedPercent +
        (window.usedPercent / ((elapsed * durationMins * 60_000) / HOUR_MS)) * hoursLeft
      : null;

  const profile: UsageHistoryProfile | undefined =
    history === undefined
      ? undefined
      : "weeklySlots" in history
        ? history
        : buildUsageHistoryProfile(history);

  if (!profile || profile.sampleCount === 0) {
    return currentPaceProjected;
  }

  // Integrate historical expected burn across [now, resetsAtMs]
  let t = now;
  let expectedAdditionalPercent = 0;

  while (t < resetsAtMs) {
    const nextHourStart = (Math.floor(t / HOUR_MS) + 1) * HOUR_MS;
    const sliceEnd = Math.min(resetsAtMs, nextHourStart);
    const sliceHours = (sliceEnd - t) / HOUR_MS;

    const date = DateTime.toDate(DateTime.makeUnsafe(t));
    const day = date.getUTCDay();
    const hour = date.getUTCHours();

    const slot = profile.weeklySlots[day]?.[hour];
    const diurnal = profile.diurnalHours[hour];

    let rate = 0;
    if (slot && slot.observedHours >= 0.5) {
      rate = slot.ratePerHour;
    } else if (diurnal && diurnal.observedHours >= 1) {
      rate = diurnal.ratePerHour;
    } else {
      rate = profile.globalBurnPerHour;
    }

    expectedAdditionalPercent += sliceHours * rate;
    t = sliceEnd;
  }

  const historicalProjected = window.usedPercent + expectedAdditionalPercent;

  if (currentPaceProjected !== null) {
    // When historical patterns cover the remaining window, give strong weight
    // to history over naive linear extrapolation of short bursts.
    const historyWeight = Math.min(0.85, 0.65 + profile.sampleCount * 0.05);
    const blended =
      historyWeight * historicalProjected + (1 - historyWeight) * currentPaceProjected;
    return Math.max(window.usedPercent, Math.min(1000, blended));
  }

  return Math.max(window.usedPercent, Math.min(1000, historicalProjected));
}
