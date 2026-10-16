import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";
import { ClientSettingsSchema, ClientSettingsPatch } from "./settings.ts";
const decodeSettings = Schema.decodeUnknownSync(ClientSettingsSchema);
const decodePatch = Schema.decodeUnknownSync(ClientSettingsPatch);
describe("cache warning settings", () => {
  it("keeps warnings enabled when loading settings from before this feature", () => {
    expect(decodeSettings({})).toMatchObject({
      cacheMutedWarnings: [],
      cacheNoticesSnoozedUntil: 0,
    });
  });
  it("round-trips category mutes and snooze without changing unrelated settings", () => {
    const patch = {
      cacheMutedWarnings: ["model", "expiry"],
      cacheNoticesSnoozedUntil: 1_800_000_000_000,
    };
    expect(decodePatch(patch)).toEqual(patch);
  });
  it("rejects invalid snooze timestamps and warning categories", () => {
    for (const value of [-1, Infinity, NaN, 0.5])
      expect(() => decodePatch({ cacheNoticesSnoozedUntil: value })).toThrow();
    expect(() => decodePatch({ cacheMutedWarnings: ["all"] })).toThrow();
  });
});
