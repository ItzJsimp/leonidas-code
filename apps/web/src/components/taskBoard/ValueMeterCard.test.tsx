import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vite-plus/test";

vi.mock("@effect/atom-react", () => ({
  useAtomValue: (atom: string) => (atom === "settings" ? { subscriptionPaidUsd: {} } : []),
}));
vi.mock("../../state/server", () => ({
  primaryServerSettingsAtom: "settings",
  primaryServerProvidersAtom: "providers",
  serverEnvironment: { updateSettings: {} },
}));
vi.mock("../../state/environments", () => ({ usePrimaryEnvironmentId: () => null }));
vi.mock("../../state/session", () => ({ useEnvironmentScope: () => false }));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));
vi.mock("../../state/usage", () => ({
  useUsage: () => ({
    isPending: false,
    isPartial: false,
    environments: [{ summary: { pricing: { source: "Published rate table" } } }],
    shown: {
      merged: {
        providers: [{ provider: "claude", costUsd: 12, records: 2 }],
        models: [{ provider: "claude", records: 2, unpricedRecords: 0 }],
      },
    },
  }),
}));
import { ValueMeterCard } from "./ValueMeterCard";

it("renders provider value with estimate labels and source, without assuming payment", () => {
  const html = renderToStaticMarkup(<ValueMeterCard />);
  expect(html).toContain("Value meter");
  expect(html).toContain("$12.00");
  expect(html.replace(/<[^>]+>/g, "")).toContain("estimate: Published rate table");
  expect(html).toContain("Savings: Unknown");
  expect(html).toContain("claude paid this month in USD");
});
