import * as Schema from "effect/Schema";
import { expect, it } from "vite-plus/test";
import { ServerSettings, ServerSettingsPatch } from "./settings.ts";

const decodeSettings = Schema.decodeSync(ServerSettings);
const decodePatch = Schema.decodeUnknownSync(ServerSettingsPatch);

it("defaults to no paid amounts and keeps months separate", () => {
  expect(decodeSettings({}).subscriptionPaidUsd).toEqual({});
  const subscriptionPaidUsd = { "2026-10": { claude: 20 }, "2026-11": { claude: 0 } };
  expect(decodePatch({ subscriptionPaidUsd })).toMatchObject({ subscriptionPaidUsd });
});

it("rejects negative, non-finite and invalid-month amounts", () => {
  for (const value of [-1, Infinity, NaN]) {
    expect(() => decodePatch({ subscriptionPaidUsd: { "2026-10": { claude: value } } })).toThrow();
  }
  expect(() => decodePatch({ subscriptionPaidUsd: { "2026-13": { claude: 20 } } })).toThrow();
});
