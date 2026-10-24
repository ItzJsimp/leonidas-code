import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({ checkedAt: "" }));
vi.mock("@t3tools/shared/usageLimits", async (original) => ({
  ...(await original<typeof import("@t3tools/shared/usageLimits")>()),
  collectLimitAccounts: () => [],
  collectLimitPools: () => [{ driver: "codex", accounts: [], windows: [] }],
  collectLimitNotices: () => [],
  collectExternalUsageLinks: () => [],
  poolCheckedAt: () => state.checkedAt,
}));

import { UsageLimitsPooled } from "./UsageLimitsPooled";

describe("usage check timestamp", () => {
  it("distinguishes today, yesterday, and an older year in local time", () => {
    const now = new Date(2026, 9, 23, 12).getTime();
    const shown = (date: Date) => {
      state.checkedAt = date.toISOString();
      return renderToStaticMarkup(<UsageLimitsPooled presentations={new Map()} now={now} />);
    };
    expect(shown(new Date(2026, 9, 23, 9, 15))).toContain(">9:15 AM</time>");
    expect(shown(new Date(2026, 9, 22, 9, 15))).toContain(">yesterday at 9:15 AM</time>");
    expect(shown(new Date(2025, 9, 22, 9, 15))).toMatch(/2025.*9:15 AM<\/time>/);
  });
});
