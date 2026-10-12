import { describe, expect, it } from "vite-plus/test";

import { isInNotificationQuietHours } from "./threadNotifications";

const settings = (start: string, end: string, enabled = true) => ({
  notificationQuietHoursEnabled: enabled,
  notificationQuietHoursStart: start,
  notificationQuietHoursEnd: end,
});
const at = (hours: number, minutes = 0) => new Date(2026, 9, 12, hours, minutes);

describe("isInNotificationQuietHours", () => {
  it("is never quiet while the setting is off", () => {
    expect(isInNotificationQuietHours(settings("22:00", "07:00", false), at(23))).toBe(false);
  });

  it("covers a window that crosses midnight", () => {
    const quiet = settings("22:00", "07:00");
    expect(isInNotificationQuietHours(quiet, at(23, 30))).toBe(true);
    expect(isInNotificationQuietHours(quiet, at(3))).toBe(true);
    expect(isInNotificationQuietHours(quiet, at(7))).toBe(false);
    expect(isInNotificationQuietHours(quiet, at(12))).toBe(false);
  });

  it("covers a same-day window and ignores an empty one", () => {
    expect(isInNotificationQuietHours(settings("13:00", "14:00"), at(13, 30))).toBe(true);
    expect(isInNotificationQuietHours(settings("13:00", "14:00"), at(14))).toBe(false);
    expect(isInNotificationQuietHours(settings("09:00", "09:00"), at(9))).toBe(false);
  });
});
