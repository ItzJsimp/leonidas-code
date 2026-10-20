import { expect, it } from "vite-plus/test";
import { buildValueMeter } from "./valueMeter.logic";

it("labels estimated value and savings with their sources", () => {
  const rows = buildValueMeter({
    providers: [{ provider: "claude", costUsd: 45, records: 3 }],
    models: [{ provider: "claude", records: 3, unpricedRecords: 0 }],
    paid: { claude: 20 },
    pricingSource: "Published model rate table",
  });
  expect(rows[0]).toMatchObject({
    provider: "claude",
    paidUsd: 20,
    valueUsd: 45,
    savingsUsd: 25,
    valueSource: "estimate: Published model rate table and provider usage records",
    savingsSource: "estimate: list-price value minus user-entered paid amount",
  });
});

it("does not turn missing prices or missing paid amounts into zero", () => {
  const rows = buildValueMeter({
    providers: [{ provider: "codex", costUsd: 0, records: 2 }],
    models: [{ provider: "codex", records: 2, unpricedRecords: 2 }],
    paid: { claude: 0 },
    pricingSource: "Cached rate table",
  });
  expect(rows.find((row) => row.provider === "codex")).toMatchObject({
    valueUsd: null,
    savingsUsd: null,
    paidUsd: null,
  });
  expect(rows.find((row) => row.provider === "claude")?.paidUsd).toBe(0);
});

it("reports partial pricing and preserves negative savings", () => {
  const [row] = buildValueMeter({
    providers: [{ provider: "claude", costUsd: 4, records: 3 }],
    models: [{ provider: "claude", records: 3, unpricedRecords: 1 }],
    paid: { claude: 20 },
    pricingSource: "Rate table",
  });
  expect(row).toMatchObject({ valueUsd: 4, savingsUsd: -16, unpricedRecords: 1 });
});
